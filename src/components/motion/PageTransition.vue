<script setup>
// Remove the outgoing DOM in the same update. The incoming page carries the
// short transition, so focus and queries never encounter two page panels.
function removePreviousPage(_element, done) { done(); }
</script>
<template><Transition name="page-arrive" @leave="removePreviousPage"><slot /></Transition></template>
