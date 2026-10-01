import * as CANNON from 'cannon-es';

export function createPhysicsWorld() {
  const world = new CANNON.World();
  world.gravity.set(0, -9.81, 0);
  world.broadphase = new CANNON.SAPBroadphase(world);
  world.allowSleep = true;
  return world;
}

export function createSpringSystem({
  massKg,
  anchorPosition,
  initialPosition,
  restLength,
  stiffness,
  damping
}) {
  const anchor = new CANNON.Body({ mass: 0 });
  anchor.position.set(anchorPosition.x, anchorPosition.y, anchorPosition.z);

  const loadShape = new CANNON.Sphere(0.18);
  const load = new CANNON.Body({
    mass: massKg,
    shape: loadShape,
    position: new CANNON.Vec3(initialPosition.x, initialPosition.y, initialPosition.z),
    linearDamping: 0.04,
    angularDamping: 0.04
  });

  const spring = new CANNON.Spring(anchor, load, {
    restLength,
    stiffness,
    damping
  });

  return { anchor, load, spring };
}

export function addSpringSystemToWorld(world, system) {
  world.addBody(system.anchor);
  world.addBody(system.load);
}

export function updateSpringMass(system, massKg) {
  system.load.mass = massKg;
  system.load.updateMassProperties();
  system.load.wakeUp();
}

export function resetSpringSystem(system, position) {
  system.load.position.set(position.x, position.y, position.z);
  system.load.velocity.set(0, 0, 0);
  system.load.angularVelocity.set(0, 0, 0);
  system.load.quaternion.set(0, 0, 0, 1);
  system.load.wakeUp();
}

export function removeSpringSystemFromWorld(world, system) {
  if (!system) return;
  world.removeBody(system.load);
  world.removeBody(system.anchor);
}

export function stepPhysics(world, systems, deltaSeconds) {
  for (const system of systems) {
    system.spring.applyForce();
  }

  world.step(1 / 60, Math.min(deltaSeconds, 0.05), 3);
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
