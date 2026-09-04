/** Default Three.js block: seek-driven spin. `t` is 0–1 over the block window (or scene). */
export const DEFAULT_THREE_SRC = `const mesh = new THREE.Mesh(
  new THREE.IcosahedronGeometry(0.85, 0),
  new THREE.MeshStandardMaterial({ color: 0xc45c26, metalness: 0.25, roughness: 0.4 })
);
scene.add(mesh);
scene.add(new THREE.AmbientLight(0xffffff, 0.55));
const key = new THREE.DirectionalLight(0xfff2d6, 1.15);
key.position.set(2.2, 2.4, 3);
scene.add(key);
camera.position.set(0, 0.2, 2.6);
camera.lookAt(0, 0, 0);

return function update({ t }) {
  mesh.rotation.y = t * Math.PI * 2;
  mesh.rotation.x = 0.28 + Math.sin(t * Math.PI * 2) * 0.08;
};
`;
