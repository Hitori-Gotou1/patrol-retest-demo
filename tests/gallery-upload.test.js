import test from 'node:test';
import assert from 'node:assert/strict';
import { isPublicGalleryKey, validateGalleryConfig } from '../src/services/galleryCloudConfig.js';
import {
  MAX_UPLOAD_BYTES, MAX_IMAGE_PIXELS, validateUploadFile,
  validateImageDimensions, validateGalleryText, validateImageSignature
} from '../src/services/galleryUploadRules.js';

const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13]);
const jpeg = Uint8Array.from([255, 216, 255, 224, 0, 16, 74, 70, 73, 70, 0, 1]);
const webp = Uint8Array.from([82, 73, 70, 70, 24, 0, 0, 0, 87, 69, 66, 80]);
const file = (bytes, type, name = 'image') => new File([bytes], name, { type });

test('上传接受三种图片格式；拒绝空文件、SVG 和超出 10 MB 的文件', () => {
  for (const [type, ext] of [['image/jpeg', 'jpg'], ['image/png', 'png'], ['image/webp', 'webp']]) {
    assert.equal(validateUploadFile(file(png, type)), ext);
  }
  assert.throws(() => validateUploadFile(null));
  assert.throws(() => validateUploadFile(file('', 'image/png')), /10 MB/);
  assert.throws(() => validateUploadFile(file('<svg/>', 'image/svg+xml')), /JPG/);
  assert.throws(() => validateUploadFile(file('text', 'text/plain')), /JPG/);
  assert.throws(() => validateUploadFile(file('text', '')), /JPG/);
  assert.equal(validateUploadFile(file(new Uint8Array(MAX_UPLOAD_BYTES), 'image/png')), 'png');
  assert.throws(() => validateUploadFile(file(new Uint8Array(MAX_UPLOAD_BYTES + 1), 'image/png')), /10 MB/);
});

test('文件头必须匹配声明格式；改名 SVG、JPEG 伪装 PNG 和截断头部被拒绝', async () => {
  for (const [bytes, type] of [[png, 'image/png'], [jpeg, 'image/jpeg'], [webp, 'image/webp']]) {
    await assert.doesNotReject(validateImageSignature(file(bytes, type)));
  }
  await assert.rejects(validateImageSignature(file('<svg xmlns="http://www.w3.org/2000/svg"></svg>', 'image/png', 'renamed.png')), /格式不符/);
  await assert.rejects(validateImageSignature(file(jpeg, 'image/png', 'renamed.png')), /格式不符/);
  await assert.rejects(validateImageSignature(file(png, 'image/jpeg', 'renamed.jpg')), /格式不符/);
  await assert.rejects(validateImageSignature(file(png.slice(0, 7), 'image/png')), /格式不符/);
  await assert.rejects(validateImageSignature(file(webp.slice(0, 10), 'image/webp')), /格式不符/);
  await assert.rejects(validateImageSignature(file('RIFF1234WAVE', 'image/webp')), /格式不符/);
});

test('图片尺寸接受 4000 万像素边界，拒绝超大、空尺寸和非整数', () => {
  assert.equal(MAX_IMAGE_PIXELS, 40_000_000);
  assert.doesNotThrow(() => validateImageDimensions(8000, 5000));
  assert.doesNotThrow(() => validateImageDimensions(1, 1));
  for (const dimensions of [[8001, 5000], [0, 10], [10, -1], [10.5, 10], [NaN, 10], [Infinity, 10], ['10', 10]]) {
    assert.throws(() => validateImageDimensions(...dimensions), /尺寸/);
  }
});

test('标题必填，文字按修剪后的长度验证，描述和来源可留空', () => {
  assert.deepEqual(validateGalleryText({ title: '  一起去演出  ', alt: ' 四位成员 ', credit: '  站主提供  ' }), {
    title: '一起去演出', alt: '四位成员', credit: '站主提供'
  });
  assert.deepEqual(validateGalleryText({ title: '标题' }), { title: '标题', alt: '', credit: '' });
  for (const title of ['', ' \n\t ', '一'.repeat(121)]) assert.throws(() => validateGalleryText({ title }), /标题/);
  assert.doesNotThrow(() => validateGalleryText({ title: ' 一'.trim().repeat(120) + ' ', alt: '图'.repeat(300), credit: '源'.repeat(200) }));
  assert.throws(() => validateGalleryText({ title: '标题', alt: '图'.repeat(301) }), /最多/);
  assert.throws(() => validateGalleryText({ title: '标题', credit: '源'.repeat(201) }), /最多/);
});


test('图片格式白名单不接受对象继承属性', async () => {
  for (const type of ['constructor', 'toString', '__proto__']) {
    // 使用原始对象保留大小写，避免 File 构造器将 MIME 自动转成小写。
    const candidate = { type, size: 12, slice: () => new Blob([png]) };
    assert.throws(() => validateUploadFile(candidate), /JPG/);
    await assert.rejects(validateImageSignature(candidate), /JPG/);
  }
});

const legacyKey = role => `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ role, iss: 'supabase' })).toString('base64url')}.test_signature`;

test('空配置关闭上传；完整公开配置允许启用，部分配置拒绝构建', () => {
  assert.equal(validateGalleryConfig('', ''), false);
  assert.equal(validateGalleryConfig(undefined, undefined), false);
  assert.throws(() => validateGalleryConfig('https://example.supabase.co', ''), /不完整/);
  assert.throws(() => validateGalleryConfig('', 'sb_publishable_test123'), /不完整/);
  assert.equal(validateGalleryConfig('https://example.supabase.co', 'sb_publishable_test123'), true);
  assert.equal(validateGalleryConfig('https://example.supabase.co/', legacyKey('anon')), true);
});

test('服务密钥与非法公开密钥拒绝构建，legacy anon 密钥可用', () => {
  for (const key of ['sb_secret_test123', legacyKey('service_role'), legacyKey('authenticated'), 'sb_publishable_', 'sb_publishable_bad value', 'malformed']) {
    assert.equal(isPublicGalleryKey(key), false);
    assert.throws(() => validateGalleryConfig('https://example.supabase.co', key), /禁止使用/);
  }
  assert.equal(isPublicGalleryKey(null), false);
  assert.equal(isPublicGalleryKey(42), false);
  assert.equal(isPublicGalleryKey('sb_publishable_test123'), true);
  assert.equal(isPublicGalleryKey(legacyKey('anon')), true);
});

test('收藏服务仅允许 HTTPS 根地址，不接受路径、查询或片段', () => {
  for (const url of ['http://example.supabase.co', 'https://example.supabase.co/path', 'https://example.supabase.co?key=test', 'https://example.supabase.co/#fragment', 'not-a-url']) {
    assert.throws(() => validateGalleryConfig(url, 'sb_publishable_test123'), /HTTPS/);
  }
});
