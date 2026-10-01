import * as CANNON from 'cannon-es';

export function createPhysicsWorld() {
  const world = new CANNON.World();
  world.gravity.set(0, -9.81, 0);
  world.broadphase = new CANNON.SAPBroadphase(world);
  world.allowSleep = true;
  return world;
}

export function createMassBody(massKg, position) {
  const shape = new CANNON.Sphere(0.18);
  const body = new CANNON.Body({
    mass: massKg,
    shape,
    position: new CANNON.Vec3(position.x, position.y, position.z),
    linearDamping: 0.08,
    angularDamping: 0.08
  });
  return body;
}

export function syncMeshToBody(mesh, body) {
  mesh.position.set(body.position.x, body.position.y, body.position.z);
  mesh.quaternion.set(
    body.quaternion.x,
    body.quaternion.y,
    body.quaternion.z,
    body.quaternion.w
  );
}
