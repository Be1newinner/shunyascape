import * as THREE from 'three';
import { SimContext, AnimalAgent } from './Types';

export function createAnimalMesh(
  ctx: SimContext,
  type: 'cow' | 'dog' | 'cat' | 'bird',
  agent: Partial<AnimalAgent>
): THREE.Group {
  const group = new THREE.Group();

  switch (type) {
    case 'cow': {
      // Body
      const bodyGeom = ctx.getGeometry('cow_body', () => new THREE.BoxGeometry(0.5, 0.4, 0.7));
      const bodyMat = ctx.getMaterial('cow_white', { color: '#ffffff', roughness: 0.9 });
      const body = new THREE.Mesh(bodyGeom, bodyMat);
      body.position.y = 0.45;
      body.castShadow = true;
      body.receiveShadow = true;
      group.add(body);

      // Spots (Black boxes)
      const spotMat = ctx.getMaterial('cow_black', { color: '#111111', roughness: 0.9 });
      const spot1 = new THREE.Mesh(ctx.getGeometry('cow_spot1', () => new THREE.BoxGeometry(0.2, 0.2, 0.2)), spotMat);
      spot1.position.set(0.26, 0.5, 0.1);
      group.add(spot1);
      const spot2 = new THREE.Mesh(ctx.getGeometry('cow_spot2', () => new THREE.BoxGeometry(0.2, 0.15, 0.25)), spotMat);
      spot2.position.set(-0.26, 0.45, -0.15);
      group.add(spot2);

      // Neck
      const neckGeom = ctx.getGeometry('cow_neck', () => new THREE.BoxGeometry(0.2, 0.2, 0.2));
      const neck = new THREE.Mesh(neckGeom, bodyMat);
      neck.position.set(0, 0.55, 0.22);
      neck.castShadow = true;
      group.add(neck);

      // Head
      const headGeom = ctx.getGeometry('cow_head', () => new THREE.BoxGeometry(0.3, 0.3, 0.35));
      const head = new THREE.Mesh(headGeom, bodyMat);
      head.position.set(0, 0.65, 0.35);
      head.castShadow = true;
      group.add(head);

      // Ears (Floppy Cow Ears)
      const earGeom = ctx.getGeometry('cow_ear', () => new THREE.BoxGeometry(0.14, 0.06, 0.06));
      const leftEar = new THREE.Mesh(earGeom, bodyMat);
      leftEar.position.set(0.18, 0.72, 0.32);
      leftEar.rotation.z = -0.25;
      const rightEar = new THREE.Mesh(earGeom, bodyMat);
      rightEar.position.set(-0.18, 0.72, 0.32);
      rightEar.rotation.z = 0.25;
      group.add(leftEar);
      group.add(rightEar);

      // Spots on Head (black ear tips or head patch)
      const headPatchGeom = ctx.getGeometry('cow_head_patch', () => new THREE.BoxGeometry(0.12, 0.12, 0.12));
      const headPatch = new THREE.Mesh(headPatchGeom, spotMat);
      headPatch.position.set(0.1, 0.75, 0.3);
      group.add(headPatch);

      // Snout (Pink)
      const snoutGeom = ctx.getGeometry('cow_snout', () => new THREE.BoxGeometry(0.24, 0.12, 0.1));
      const snoutMat = ctx.getMaterial('cow_pink', { color: '#ffb6c1', roughness: 0.8 });
      const snout = new THREE.Mesh(snoutGeom, snoutMat);
      snout.position.set(0, 0.6, 0.53);
      group.add(snout);

      // Horns
      const hornGeom = ctx.getGeometry('cow_horn', () => new THREE.BoxGeometry(0.06, 0.14, 0.06));
      const hornMat = ctx.getMaterial('cow_horns', { color: '#dddddd', roughness: 0.5 });
      const h1 = new THREE.Mesh(hornGeom, hornMat);
      h1.position.set(0.12, 0.82, 0.3);
      h1.rotation.z = -0.2;
      const h2 = new THREE.Mesh(hornGeom, hornMat);
      h2.position.set(-0.12, 0.82, 0.3);
      h2.rotation.z = 0.2;
      group.add(h1);
      group.add(h2);

      // Udders (Pink box underneath)
      const udderGeom = ctx.getGeometry('cow_udder', () => new THREE.BoxGeometry(0.16, 0.06, 0.16));
      const udder = new THREE.Mesh(udderGeom, snoutMat);
      udder.position.set(0, 0.23, -0.05);
      group.add(udder);

      // Detailed Expressive Eyes (White Sclera + Black Pupil)
      const eyeScleraGeom = ctx.getGeometry('cow_eye_sclera', () => new THREE.BoxGeometry(0.05, 0.05, 0.015));
      const eyeScleraMat = ctx.getMaterial('cow_eye_sclera_mat', { color: '#ffffff', roughness: 0.1 });
      const eyePupilGeom = ctx.getGeometry('cow_eye_pupil', () => new THREE.BoxGeometry(0.025, 0.025, 0.016));
      const eyePupilMat = ctx.getMaterial('cow_eye_pupil_mat', { color: '#111111', roughness: 0.1 });

      const leftEyeS = new THREE.Mesh(eyeScleraGeom, eyeScleraMat);
      leftEyeS.position.set(-0.08, 0.7, 0.526);
      head.add(leftEyeS);
      const leftEyeP = new THREE.Mesh(eyePupilGeom, eyePupilMat);
      leftEyeP.position.set(-0.08, 0.7, 0.53);
      head.add(leftEyeP);

      const rightEyeS = new THREE.Mesh(eyeScleraGeom, eyeScleraMat);
      rightEyeS.position.set(0.08, 0.7, 0.526);
      head.add(rightEyeS);
      const rightEyeP = new THREE.Mesh(eyePupilGeom, eyePupilMat);
      rightEyeP.position.set(0.08, 0.7, 0.53);
      head.add(rightEyeP);

      // Tail Group
      const tailGroup = new THREE.Group();
      tailGroup.position.set(0, 0.55, -0.36);
      const tailGeom = ctx.getGeometry('cow_tail', () => new THREE.BoxGeometry(0.04, 0.25, 0.04));
      const tailMesh = new THREE.Mesh(tailGeom, bodyMat);
      tailMesh.position.y = -0.125;
      tailGroup.add(tailMesh);

      const tasselGeom = ctx.getGeometry('cow_tassel', () => new THREE.BoxGeometry(0.06, 0.06, 0.06));
      const tasselMesh = new THREE.Mesh(tasselGeom, spotMat);
      tasselMesh.position.y = -0.26;
      tailGroup.add(tasselMesh);

      group.add(tailGroup);
      agent.tailPivot = tailGroup;

      // Legs (Pivots with Hooves)
      const legGeom = ctx.getGeometry('cow_leg', () => new THREE.BoxGeometry(0.12, 0.3, 0.12));
      const legMat = ctx.getMaterial('cow_legs', { color: '#eeeeee', roughness: 0.9 });
      const hoofGeom = ctx.getGeometry('cow_hoof', () => new THREE.BoxGeometry(0.124, 0.05, 0.124));
      const hoofMat = ctx.getMaterial('cow_hooves', { color: '#2b2b2b', roughness: 0.9 });
      
      const legL1 = new THREE.Group();
      legL1.position.set(0.18, 0.3, 0.22);
      const lMesh1 = new THREE.Mesh(legGeom, legMat);
      lMesh1.position.y = -0.15;
      lMesh1.castShadow = true;
      legL1.add(lMesh1);
      const hoofL1 = new THREE.Mesh(hoofGeom, hoofMat);
      hoofL1.position.set(0, -0.275, 0);
      hoofL1.castShadow = true;
      legL1.add(hoofL1);
      group.add(legL1);
      agent.legSwingPivot1 = legL1;

      const legR1 = new THREE.Group();
      legR1.position.set(-0.18, 0.3, 0.22);
      const lMesh2 = new THREE.Mesh(legGeom, legMat);
      lMesh2.position.y = -0.15;
      lMesh2.castShadow = true;
      legR1.add(lMesh2);
      const hoofR1 = new THREE.Mesh(hoofGeom, hoofMat);
      hoofR1.position.set(0, -0.275, 0);
      hoofR1.castShadow = true;
      legR1.add(hoofR1);
      group.add(legR1);
      agent.legSwingPivot2 = legR1;

      const legL2 = new THREE.Group();
      legL2.position.set(0.18, 0.3, -0.22);
      const lMesh3 = new THREE.Mesh(legGeom, legMat);
      lMesh3.position.y = -0.15;
      lMesh3.castShadow = true;
      legL2.add(lMesh3);
      const hoofL2 = new THREE.Mesh(hoofGeom, hoofMat);
      hoofL2.position.set(0, -0.275, 0);
      hoofL2.castShadow = true;
      legL2.add(hoofL2);
      group.add(legL2);

      const legR2 = new THREE.Group();
      legR2.position.set(-0.18, 0.3, -0.22);
      const lMesh4 = new THREE.Mesh(legGeom, legMat);
      lMesh4.position.y = -0.15;
      lMesh4.castShadow = true;
      legR2.add(lMesh4);
      const hoofR2 = new THREE.Mesh(hoofGeom, hoofMat);
      hoofR2.position.set(0, -0.275, 0);
      hoofR2.castShadow = true;
      legR2.add(hoofR2);
      group.add(legR2);
      break;
    }
    case 'dog': {
      // Body
      const bodyGeom = ctx.getGeometry('dog_body', () => new THREE.BoxGeometry(0.28, 0.24, 0.5));
      const bodyMat = ctx.getMaterial('dog_brown', { color: '#8b5a2b', roughness: 0.95 });
      const body = new THREE.Mesh(bodyGeom, bodyMat);
      body.position.y = 0.26;
      body.castShadow = true;
      group.add(body);

      // Head
      const headGeom = ctx.getGeometry('dog_head', () => new THREE.BoxGeometry(0.2, 0.2, 0.22));
      const head = new THREE.Mesh(headGeom, bodyMat);
      head.position.set(0, 0.44, 0.2);
      head.castShadow = true;
      group.add(head);

      // Ears (Floppy dark brown)
      const earGeom = ctx.getGeometry('dog_ear', () => new THREE.BoxGeometry(0.05, 0.16, 0.08));
      const earMat = ctx.getMaterial('dog_ears', { color: '#5c3818', roughness: 0.95 });
      const e1 = new THREE.Mesh(earGeom, earMat);
      e1.position.set(0.11, 0.42, 0.2);
      const e2 = new THREE.Mesh(earGeom, earMat);
      e2.position.set(-0.11, 0.42, 0.2);
      group.add(e1);
      group.add(e2);

      // Muzzle & Black nose tip
      const snoutGeom = ctx.getGeometry('dog_snout', () => new THREE.BoxGeometry(0.1, 0.08, 0.08));
      const snout = new THREE.Mesh(snoutGeom, bodyMat);
      snout.position.set(0, 0.40, 0.33);
      snout.castShadow = true;
      group.add(snout);

      const blackMat = ctx.getMaterial('dog_black', { color: '#111111', roughness: 0.95 });
      const noseTipGeom = ctx.getGeometry('dog_nose_tip', () => new THREE.BoxGeometry(0.04, 0.03, 0.02));
      const noseTip = new THREE.Mesh(noseTipGeom, blackMat);
      noseTip.position.set(0, 0.42, 0.375);
      group.add(noseTip);

      // Red Collar
      const collarMat = ctx.getMaterial('dog_collar', { color: '#d93838', roughness: 0.8 });
      const collarGeom = ctx.getGeometry('dog_collar_box', () => new THREE.BoxGeometry(0.16, 0.04, 0.16));
      const collar = new THREE.Mesh(collarGeom, collarMat);
      collar.position.set(0, 0.32, 0.15);
      collar.castShadow = true;
      group.add(collar);

      // Expressive Eyes (White Sclera + Black Pupil)
      const dogEyeScleraGeom = ctx.getGeometry('dog_eye_sclera', () => new THREE.BoxGeometry(0.04, 0.04, 0.015));
      const dogEyeScleraMat = ctx.getMaterial('dog_eye_sclera_mat', { color: '#ffffff', roughness: 0.1 });
      const dogEyePupilGeom = ctx.getGeometry('dog_eye_pupil', () => new THREE.BoxGeometry(0.025, 0.025, 0.016));

      const leftEyeS = new THREE.Mesh(dogEyeScleraGeom, dogEyeScleraMat);
      leftEyeS.position.set(-0.05, 0.46, 0.301);
      group.add(leftEyeS);
      const leftEyeP = new THREE.Mesh(dogEyePupilGeom, blackMat);
      leftEyeP.position.set(-0.05, 0.46, 0.306);
      group.add(leftEyeP);

      const rightEyeS = new THREE.Mesh(dogEyeScleraGeom, dogEyeScleraMat);
      rightEyeS.position.set(0.05, 0.46, 0.301);
      group.add(rightEyeS);
      const rightEyeP = new THREE.Mesh(dogEyePupilGeom, blackMat);
      rightEyeP.position.set(0.05, 0.46, 0.306);
      group.add(rightEyeP);

      // Tail
      const tailGroup = new THREE.Group();
      tailGroup.position.set(0, 0.34, -0.25);
      const tailGeom = ctx.getGeometry('dog_tail', () => new THREE.BoxGeometry(0.04, 0.16, 0.04));
      const tail = new THREE.Mesh(tailGeom, bodyMat);
      tail.position.y = 0.08;
      tail.rotation.x = Math.PI / 4;
      tail.castShadow = true;
      tailGroup.add(tail);

      // White tail tip
      const whiteMat = ctx.getMaterial('dog_white', { color: '#ffffff', roughness: 0.9 });
      const tailTipGeom = ctx.getGeometry('dog_tail_tip', () => new THREE.BoxGeometry(0.042, 0.04, 0.042));
      const tailTip = new THREE.Mesh(tailTipGeom, whiteMat);
      tailTip.position.set(0, 0.17, 0.09);
      tailTip.rotation.x = Math.PI / 4;
      tailGroup.add(tailTip);

      group.add(tailGroup);
      agent.tailPivot = tailGroup;

      // Legs with paw socks
      const legGeom = ctx.getGeometry('dog_leg', () => new THREE.BoxGeometry(0.08, 0.18, 0.08));
      const pawGeom = ctx.getGeometry('dog_paw', () => new THREE.BoxGeometry(0.082, 0.04, 0.09));
      
      const legL1 = new THREE.Group();
      legL1.position.set(0.1, 0.18, 0.16);
      const l1 = new THREE.Mesh(legGeom, bodyMat);
      l1.position.y = -0.09;
      l1.castShadow = true;
      legL1.add(l1);
      const pawL1 = new THREE.Mesh(pawGeom, whiteMat);
      pawL1.position.set(0, -0.16, 0.005);
      pawL1.castShadow = true;
      legL1.add(pawL1);
      group.add(legL1);
      agent.legSwingPivot1 = legL1;

      const legR1 = new THREE.Group();
      legR1.position.set(-0.1, 0.18, 0.16);
      const r1 = new THREE.Mesh(legGeom, bodyMat);
      r1.position.y = -0.09;
      r1.castShadow = true;
      legR1.add(r1);
      const pawR1 = new THREE.Mesh(pawGeom, whiteMat);
      pawR1.position.set(0, -0.16, 0.005);
      pawR1.castShadow = true;
      legR1.add(pawR1);
      group.add(legR1);
      agent.legSwingPivot2 = legR1;

      const legL2 = new THREE.Group();
      legL2.position.set(0.1, 0.18, -0.16);
      const l2 = new THREE.Mesh(legGeom, bodyMat);
      l2.position.y = -0.09;
      l2.castShadow = true;
      legL2.add(l2);
      const pawL2 = new THREE.Mesh(pawGeom, whiteMat);
      pawL2.position.set(0, -0.16, 0.005);
      pawL2.castShadow = true;
      legL2.add(pawL2);
      group.add(legL2);

      const legR2 = new THREE.Group();
      legR2.position.set(-0.1, 0.18, -0.16);
      const r2 = new THREE.Mesh(legGeom, bodyMat);
      r2.position.y = -0.09;
      r2.castShadow = true;
      legR2.add(r2);
      const pawR2 = new THREE.Mesh(pawGeom, whiteMat);
      pawR2.position.set(0, -0.16, 0.005);
      pawR2.castShadow = true;
      legR2.add(pawR2);
      group.add(legR2);
      break;
    }
    case 'cat': {
      // Body (Orange Voxel)
      const bodyGeom = ctx.getGeometry('cat_body', () => new THREE.BoxGeometry(0.2, 0.16, 0.38));
      const bodyMat = ctx.getMaterial('cat_orange', { color: '#ff8c00', roughness: 0.9 });
      const body = new THREE.Mesh(bodyGeom, bodyMat);
      body.position.y = 0.18;
      body.castShadow = true;
      group.add(body);

      // Head
      const headGeom = ctx.getGeometry('cat_head', () => new THREE.BoxGeometry(0.16, 0.15, 0.16));
      const head = new THREE.Mesh(headGeom, bodyMat);
      head.position.set(0, 0.3, 0.15);
      head.castShadow = true;
      group.add(head);

      // Ears (Pointy with inner pink details)
      const earGeom = ctx.getGeometry('cat_ear_box', () => new THREE.BoxGeometry(0.05, 0.06, 0.03));
      const innerEarGeom = ctx.getGeometry('cat_inner_ear_box', () => new THREE.BoxGeometry(0.03, 0.04, 0.01));
      const pinkMat = ctx.getMaterial('cat_ear_pink', { color: '#ffb6c1', roughness: 0.8 });

      const e1 = new THREE.Mesh(earGeom, bodyMat);
      e1.position.set(0.05, 0.38, 0.15);
      e1.rotation.z = -0.15;
      const e1Inner = new THREE.Mesh(innerEarGeom, pinkMat);
      e1Inner.position.set(0, 0.01, 0.015);
      e1.add(e1Inner);

      const e2 = new THREE.Mesh(earGeom, bodyMat);
      e2.position.set(-0.05, 0.38, 0.15);
      e2.rotation.z = 0.15;
      const e2Inner = new THREE.Mesh(innerEarGeom, pinkMat);
      e2Inner.position.set(0, 0.01, 0.015);
      e2.add(e2Inner);

      group.add(e1);
      group.add(e2);

      // Muzzle & Whiskers
      const catMuzzleGeom = ctx.getGeometry('cat_muzzle', () => new THREE.BoxGeometry(0.08, 0.04, 0.04));
      const muzzle = new THREE.Mesh(catMuzzleGeom, bodyMat);
      muzzle.position.set(0, 0.26, 0.245);
      group.add(muzzle);

      const noseGeom = ctx.getGeometry('cat_nose', () => new THREE.BoxGeometry(0.025, 0.02, 0.02));
      const nose = new THREE.Mesh(noseGeom, pinkMat);
      nose.position.set(0, 0.28, 0.255);
      group.add(nose);

      // Thin whiskers
      const whiskerGeom = ctx.getGeometry('cat_whisker', () => new THREE.BoxGeometry(0.12, 0.005, 0.005));
      const darkMat = ctx.getMaterial('cat_dark', { color: '#222222', roughness: 0.9 });
      
      const leftWhisker1 = new THREE.Mesh(whiskerGeom, darkMat);
      leftWhisker1.position.set(-0.06, 0.26, 0.24);
      leftWhisker1.rotation.z = 0.1;
      group.add(leftWhisker1);

      const leftWhisker2 = new THREE.Mesh(whiskerGeom, darkMat);
      leftWhisker2.position.set(-0.06, 0.245, 0.24);
      leftWhisker2.rotation.z = -0.1;
      group.add(leftWhisker2);

      const rightWhisker1 = new THREE.Mesh(whiskerGeom, darkMat);
      rightWhisker1.position.set(0.06, 0.26, 0.24);
      rightWhisker1.rotation.z = -0.1;
      group.add(rightWhisker1);

      const rightWhisker2 = new THREE.Mesh(whiskerGeom, darkMat);
      rightWhisker2.position.set(0.06, 0.245, 0.24);
      rightWhisker2.rotation.z = 0.1;
      group.add(rightWhisker2);

      // Feline green slit eyes
      const catEyeSclera = ctx.getGeometry('cat_eye_sclera', () => new THREE.BoxGeometry(0.03, 0.03, 0.015));
      const catEyeScleraMat = ctx.getMaterial('cat_eye_green', { color: '#bfff00', roughness: 0.1 });
      const catEyePupil = ctx.getGeometry('cat_eye_pupil', () => new THREE.BoxGeometry(0.008, 0.025, 0.016));

      const leftEyeS = new THREE.Mesh(catEyeSclera, catEyeScleraMat);
      leftEyeS.position.set(-0.04, 0.31, 0.231);
      group.add(leftEyeS);
      const leftEyeP = new THREE.Mesh(catEyePupil, darkMat);
      leftEyeP.position.set(-0.04, 0.31, 0.235);
      group.add(leftEyeP);

      const rightEyeS = new THREE.Mesh(catEyeSclera, catEyeScleraMat);
      rightEyeS.position.set(0.04, 0.31, 0.231);
      group.add(rightEyeS);
      const rightEyeP = new THREE.Mesh(catEyePupil, darkMat);
      rightEyeP.position.set(0.04, 0.31, 0.235);
      group.add(rightEyeP);

      // Tail
      const tailGroup = new THREE.Group();
      tailGroup.position.set(0, 0.24, -0.19);
      const tailGeom = ctx.getGeometry('cat_tail', () => new THREE.BoxGeometry(0.03, 0.2, 0.03));
      const tail = new THREE.Mesh(tailGeom, bodyMat);
      tail.position.y = 0.1;
      tail.rotation.x = Math.PI / 6;
      tail.castShadow = true;
      tailGroup.add(tail);

      // White tip on tail
      const whiteMat = ctx.getMaterial('cat_white', { color: '#ffffff', roughness: 0.9 });
      const catTailTipGeom = ctx.getGeometry('cat_tail_tip', () => new THREE.BoxGeometry(0.032, 0.04, 0.032));
      const tailTip = new THREE.Mesh(catTailTipGeom, whiteMat);
      tailTip.position.set(0, 0.19, 0.05);
      tailTip.rotation.x = Math.PI / 6;
      tailGroup.add(tailTip);

      group.add(tailGroup);
      agent.tailPivot = tailGroup;

      // Legs with paw socks
      const legGeom = ctx.getGeometry('cat_leg', () => new THREE.BoxGeometry(0.05, 0.12, 0.05));
      const pawGeom = ctx.getGeometry('cat_paw', () => new THREE.BoxGeometry(0.052, 0.03, 0.06));
      
      const legL1 = new THREE.Group();
      legL1.position.set(0.07, 0.12, 0.12);
      const l1 = new THREE.Mesh(legGeom, bodyMat);
      l1.position.y = -0.06;
      l1.castShadow = true;
      legL1.add(l1);
      const pawL1 = new THREE.Mesh(pawGeom, whiteMat);
      pawL1.position.set(0, -0.11, 0.005);
      pawL1.castShadow = true;
      legL1.add(pawL1);
      group.add(legL1);
      agent.legSwingPivot1 = legL1;

      const legR1 = new THREE.Group();
      legR1.position.set(-0.07, 0.12, 0.12);
      const r1 = new THREE.Mesh(legGeom, bodyMat);
      r1.position.y = -0.06;
      r1.castShadow = true;
      legR1.add(r1);
      const pawR1 = new THREE.Mesh(pawGeom, whiteMat);
      pawR1.position.set(0, -0.11, 0.005);
      pawR1.castShadow = true;
      legR1.add(pawR1);
      group.add(legR1);
      agent.legSwingPivot2 = legR1;

      const legL2 = new THREE.Group();
      legL2.position.set(0.07, 0.12, -0.12);
      const l2 = new THREE.Mesh(legGeom, bodyMat);
      l2.position.y = -0.06;
      l2.castShadow = true;
      legL2.add(l2);
      const pawL2 = new THREE.Mesh(pawGeom, whiteMat);
      pawL2.position.set(0, -0.11, 0.005);
      pawL2.castShadow = true;
      legL2.add(pawL2);
      group.add(legL2);

      const legR2 = new THREE.Group();
      legR2.position.set(-0.07, 0.12, -0.12);
      const r2 = new THREE.Mesh(legGeom, bodyMat);
      r2.position.y = -0.06;
      r2.castShadow = true;
      legR2.add(r2);
      const pawR2 = new THREE.Mesh(pawGeom, whiteMat);
      pawR2.position.set(0, -0.11, 0.005);
      pawR2.castShadow = true;
      legR2.add(pawR2);
      group.add(legR2);
      break;
    }
    case 'bird': {
      // Body (Red Cardinal Voxel)
      const bodyGeom = ctx.getGeometry('bird_body', () => new THREE.BoxGeometry(0.12, 0.1, 0.18));
      const bodyMat = ctx.getMaterial('bird_red', { color: '#ff2222', roughness: 0.5 });
      const body = new THREE.Mesh(bodyGeom, bodyMat);
      body.position.y = 0.5;
      body.castShadow = true;
      group.add(body);

      // Tail feathers (extending back)
      const tailFeatherGeom = ctx.getGeometry('bird_tail_feathers', () => new THREE.BoxGeometry(0.08, 0.02, 0.12));
      const tailFeathers = new THREE.Mesh(tailFeatherGeom, bodyMat);
      tailFeathers.position.set(0, 0.49, -0.12);
      tailFeathers.rotation.x = -Math.PI / 12;
      tailFeathers.castShadow = true;
      group.add(tailFeathers);

      // Head
      const headGeom = ctx.getGeometry('bird_head', () => new THREE.BoxGeometry(0.08, 0.08, 0.08));
      const head = new THREE.Mesh(headGeom, bodyMat);
      head.position.set(0, 0.58, 0.08);
      head.castShadow = true;
      group.add(head);

      // Feather Crest
      const crestGeom = ctx.getGeometry('bird_crest', () => new THREE.BoxGeometry(0.02, 0.06, 0.06));
      const crest = new THREE.Mesh(crestGeom, bodyMat);
      crest.position.set(0, 0.64, 0.04);
      crest.rotation.x = -Math.PI / 6;
      crest.castShadow = true;
      group.add(crest);

      // Beak (Yellow)
      const beakGeom = ctx.getGeometry('bird_beak', () => new THREE.ConeGeometry(0.02, 0.05, 4));
      const beakMat = ctx.getMaterial('bird_beak', { color: '#ffcc00', roughness: 0.1 });
      const beak = new THREE.Mesh(beakGeom, beakMat);
      beak.rotation.x = Math.PI / 2;
      beak.position.set(0, 0.58, 0.14);
      group.add(beak);

      // Tiny Eyes
      const eyeGeom = ctx.getGeometry('bird_eye_box', () => new THREE.BoxGeometry(0.015, 0.015, 0.015));
      const eyeMat = ctx.getMaterial('bird_eye_black', { color: '#000000', roughness: 0.1 });
      const leftEye = new THREE.Mesh(eyeGeom, eyeMat);
      leftEye.position.set(-0.042, 0.59, 0.09);
      group.add(leftEye);

      const rightEye = new THREE.Mesh(eyeGeom, eyeMat);
      rightEye.position.set(0.042, 0.59, 0.09);
      group.add(rightEye);

      // Yellow legs/feet supporting the bird
      const legGeom = ctx.getGeometry('bird_leg_box', () => new THREE.BoxGeometry(0.015, 0.08, 0.015));
      const footMat = ctx.getMaterial('bird_foot', { color: '#ffaa00', roughness: 0.9 });
      
      const leftLeg = new THREE.Mesh(legGeom, footMat);
      leftLeg.position.set(0.03, 0.41, 0.04);
      leftLeg.castShadow = true;
      group.add(leftLeg);

      const rightLeg = new THREE.Mesh(legGeom, footMat);
      rightLeg.position.set(-0.03, 0.41, 0.04);
      rightLeg.castShadow = true;
      group.add(rightLeg);

      // Left Wing (Pivot)
      const wingGeom = ctx.getGeometry('bird_wing', () => new THREE.BoxGeometry(0.02, 0.08, 0.14));
      const leftWing = new THREE.Group();
      leftWing.position.set(0.065, 0.5, 0);
      const w1 = new THREE.Mesh(wingGeom, bodyMat);
      w1.position.y = 0.03;
      w1.rotation.z = -Math.PI / 6;
      w1.castShadow = true;
      leftWing.add(w1);
      group.add(leftWing);
      agent.leftWingPivot = leftWing;

      // Right Wing (Pivot)
      const rightWing = new THREE.Group();
      rightWing.position.set(-0.065, 0.5, 0);
      const w2 = new THREE.Mesh(wingGeom, bodyMat);
      w2.position.y = 0.03;
      w2.rotation.z = Math.PI / 6;
      w2.castShadow = true;
      rightWing.add(w2);
      group.add(rightWing);
      agent.rightWingPivot = rightWing;
      break;
    }
  }

  return group;
}

export function spawnAnimals(ctx: SimContext, animalsList: AnimalAgent[]) {
  const types: ('cow' | 'dog' | 'cat' | 'bird')[] = ['cow', 'dog', 'cat', 'bird'];
  
  for (let i = 0; i < 6; i++) {
    const type = types[i % types.length];
    const spawnX = (Math.random() - 0.5) * (ctx.gridSize * ctx.cellSize - 4);
    const spawnZ = (Math.random() - 0.5) * (ctx.gridSize * ctx.cellSize - 4);
    const yVal = type === 'bird' ? 6.0 + Math.random() * 4.0 : 0;

    const group = new THREE.Group();
    group.position.set(spawnX, yVal, spawnZ);

    const agent: Partial<AnimalAgent> = {};
    const mesh = createAnimalMesh(ctx, type, agent);
    group.add(mesh);
    ctx.scene.add(group);

    const fullAgent: AnimalAgent = {
      id: `animal_${type}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      mesh: group,
      x: spawnX,
      z: spawnZ,
      targetX: spawnX,
      targetZ: spawnZ,
      state: type === 'bird' ? 'flying' : 'idle',
      speed: type === 'bird' ? 3.0 : 0.8 + Math.random() * 0.6,
      bounceTimer: Math.random() * 5,
      idleTimer: Math.random() * 4,
      legSwingPivot1: agent.legSwingPivot1,
      legSwingPivot2: agent.legSwingPivot2,
      tailPivot: agent.tailPivot,
      leftWingPivot: agent.leftWingPivot,
      rightWingPivot: agent.rightWingPivot
    };

    animalsList.push(fullAgent);
  }
}

export function updateAnimals(
  ctx: SimContext,
  animalsList: AnimalAgent[],
  delta: number
) {
  const halfGrid = (ctx.gridSize * ctx.cellSize) / 2;

  animalsList.forEach(a => {
    // 1. Movement AI
    const dx = a.targetX - a.x;
    const dz = a.targetZ - a.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist > 0.1) {
      a.state = a.type === 'bird' ? 'flying' : 'wandering';
      const step = a.speed * delta;
      
      if (dist <= step) {
        a.x = a.targetX;
        a.z = a.targetZ;
      } else {
        a.x += (dx / dist) * step;
        a.z += (dz / dist) * step;
        
        // Rotation facing movement
        a.mesh.rotation.y = Math.atan2(dx, dz);
      }
      
      a.mesh.position.x = a.x;
      a.mesh.position.z = a.z;
    } else {
      a.state = 'idle';
      a.idleTimer -= delta;
      
      if (a.idleTimer <= 0) {
        // Find a new target to wander/fly to
        a.idleTimer = 3.0 + Math.random() * 5.0;
        
        if (a.type === 'bird') {
          // Fly to a random roof, tree, or high point
          a.targetX = (Math.random() - 0.5) * (ctx.gridSize * ctx.cellSize - 6);
          a.targetZ = (Math.random() - 0.5) * (ctx.gridSize * ctx.cellSize - 6);
          
          // Randomly transition flying Y altitude
          const nextY = 5.0 + Math.random() * 6.0;
          a.mesh.position.y = nextY;
        } else {
          // Wander to nearby coordinates on ground
          const rx = a.x + (Math.random() - 0.5) * 15;
          const rz = a.z + (Math.random() - 0.5) * 15;
          a.targetX = Math.max(-halfGrid + 1, Math.min(halfGrid - 1, rx));
          a.targetZ = Math.max(-halfGrid + 1, Math.min(halfGrid - 1, rz));
        }
      }
    }

    // 2. Animations
    a.bounceTimer += delta * (a.state !== 'idle' ? 6.0 : 2.0);
    const time = a.bounceTimer;

    // Leg swinging (cow, dog, cat)
    if (a.legSwingPivot1 && a.legSwingPivot2) {
      if (a.state !== 'idle') {
        const swing = Math.sin(time) * 0.45;
        a.legSwingPivot1.rotation.x = swing;
        a.legSwingPivot2.rotation.x = -swing;
      } else {
        a.legSwingPivot1.rotation.x = 0;
        a.legSwingPivot2.rotation.x = 0;
      }
    }

    // Tail wagging (dog, cat)
    if (a.tailPivot) {
      if (a.state !== 'idle') {
        a.tailPivot.rotation.y = Math.sin(time * 1.5) * 0.3;
      } else {
        a.tailPivot.rotation.y = Math.sin(time * 0.5) * 0.1;
      }
    }

    // Wing flapping (bird)
    if (a.leftWingPivot && a.rightWingPivot) {
      const flap = Math.sin(time * 10.0) * 0.7; // Fast wings flapping
      a.leftWingPivot.rotation.z = flap;
      a.rightWingPivot.rotation.z = -flap;
    }
  });
}
