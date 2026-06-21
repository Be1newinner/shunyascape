import * as THREE from 'three';
import { SimContext } from './Types';

export class WeatherManager {
  private ctx: SimContext;
  public ambientLight!: THREE.AmbientLight;
  public hemiLight!: THREE.HemisphereLight;
  public dirLight!: THREE.DirectionalLight;
  public clouds: THREE.Group[] = [];

  private skyColorDay = new THREE.Color('#7ec0ee');
  private skyColorSunset = new THREE.Color('#fd5e53');
  private skyColorNight = new THREE.Color('#0a1128');
  private fogColorDay = new THREE.Color('#e0f0ff');
  private fogColorSunset = new THREE.Color('#ffb380');
  private fogColorNight = new THREE.Color('#050814');

  constructor(ctx: SimContext) {
    this.ctx = ctx;
    this.initLights();
    this.generateClouds();
  }

  private initLights() {
    this.ctx.scene.background = this.skyColorDay;
    this.ctx.scene.fog = new THREE.FogExp2(this.fogColorDay, 0.015);

    this.ambientLight = new THREE.AmbientLight('#ffffff', 0.4);
    this.ctx.scene.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight('#ffffff', '#444444', 0.4);
    this.hemiLight.position.set(0, 50, 0);
    this.ctx.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight('#ffffff', 1.2);
    this.dirLight.position.set(30, 40, 20);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 1024;
    this.dirLight.shadow.mapSize.height = 1024;
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 150;

    const d = 25;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.dirLight.shadow.bias = -0.0005;
    this.ctx.scene.add(this.dirLight);
    this.ctx.scene.add(this.dirLight.target);
  }

  private generateClouds() {
    const cloudGroup = new THREE.Group();
    const cloudMat = this.ctx.getMaterial('cloud', {
      color: '#ffffff',
      roughness: 1.0,
      metalness: 0.0,
      flatShading: true,
      transparent: true,
      opacity: 0.95
    });

    for (let c = 0; c < 12; c++) {
      const singleCloud = new THREE.Group();
      const numPuffs = 4 + Math.floor(Math.random() * 4);

      for (let p = 0; p < numPuffs; p++) {
        const r = 2 + Math.random() * 3;
        const puffGeom = new THREE.SphereGeometry(r, 6, 6);
        const puff = new THREE.Mesh(puffGeom, cloudMat);
        puff.position.set(
          (p - numPuffs / 2) * 2.5,
          Math.random() * 1.0,
          (Math.random() - 0.5) * 2
        );
        puff.scale.set(1, 0.7 + Math.random() * 0.4, 0.8 + Math.random() * 0.4);
        singleCloud.add(puff);
      }

      singleCloud.position.set(
        (Math.random() - 0.5) * 160,
        18 + Math.random() * 8,
        (Math.random() - 0.5) * 160
      );
      this.clouds.push(singleCloud);
      cloudGroup.add(singleCloud);
    }
    this.ctx.scene.add(cloudGroup);
  }

  public updateClouds(delta: number) {
    this.clouds.forEach(cloud => {
      cloud.position.x += 1.5 * delta;
      if (cloud.position.x > 150) {
        cloud.position.x = -150;
        cloud.position.z = (Math.random() - 0.5) * 160;
      }
    });
  }

  public updateTime(timeOfDay: number, timeSpeed: number, delta: number): number {
    const nextTime = (timeOfDay + delta * timeSpeed * 0.1) % 24;

    const angle = ((nextTime - 6) / 24) * Math.PI * 2;
    // Make directional light follow the camera target (player)
    const targetPos = new THREE.Vector3(0, 0, 0);
    if (this.ctx.controls && this.ctx.controls.target) {
      targetPos.copy(this.ctx.controls.target);
    }
    this.dirLight.position.x = targetPos.x + Math.cos(angle) * 60;
    this.dirLight.position.y = targetPos.y + Math.sin(angle) * 60;
    this.dirLight.position.z = targetPos.z + 20;
    this.dirLight.target.position.copy(targetPos);
    this.dirLight.target.updateMatrixWorld();

    let skyCol = this.skyColorDay;
    let fogCol = this.fogColorDay;
    let sunIntensity = 1.2;
    let isNight = false;

    if (nextTime >= 18.0 && nextTime < 20.0) {
      const t = (nextTime - 18.0) / 2.0;
      skyCol = this.skyColorSunset.clone().lerp(this.skyColorNight, t);
      fogCol = this.fogColorSunset.clone().lerp(this.fogColorNight, t);
      sunIntensity = 1.2 * (1.0 - t);
    } else if (nextTime >= 20.0 || nextTime < 4.0) {
      skyCol = this.skyColorNight;
      fogCol = this.fogColorNight;
      sunIntensity = 0.0;
      isNight = true;
    } else if (nextTime >= 4.0 && nextTime < 6.0) {
      const t = (nextTime - 4.0) / 2.0;
      skyCol = this.skyColorNight.clone().lerp(this.skyColorSunset, t);
      fogCol = this.fogColorNight.clone().lerp(this.fogColorSunset, t);
      sunIntensity = 0.4 * t;
    } else if (nextTime >= 6.0 && nextTime < 8.0) {
      const t = (nextTime - 6.0) / 2.0;
      skyCol = this.skyColorSunset.clone().lerp(this.skyColorDay, t);
      fogCol = this.fogColorSunset.clone().lerp(this.fogColorDay, t);
      sunIntensity = 0.4 + 0.8 * t;
    }

    this.ctx.scene.background = skyCol;
    if (this.ctx.scene.fog) {
      (this.ctx.scene.fog as THREE.FogExp2).color = fogCol;
    }

    this.dirLight.intensity = sunIntensity;
    this.hemiLight.intensity = isNight ? 0.15 : 0.4;
    this.ambientLight.color.set(isNight ? '#112244' : '#ffffff');

    this.updateBuildingWindows(isNight);

    return nextTime;
  }

  private updateBuildingWindows(isNight: boolean) {
    const emissiveColor = isNight ? new THREE.Color('#ffcc44') : new THREE.Color('#000000');
    const mat = this.ctx.getMaterial('lit_window', null) as THREE.MeshLambertMaterial;
    if (mat) {
      mat.emissive.copy(emissiveColor);
    }
  }
}
