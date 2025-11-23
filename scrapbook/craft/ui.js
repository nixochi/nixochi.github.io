import GUI from 'three/addons/libs/lil-gui.module.min.js';

export function createUI(world) {
    const gui = new GUI();

    world.size.length = world.size.width;

    gui.add(world.size,'width', 1, 128, 1).name('Width').onChange((value) => {
        world.size.length = value;
    });
    gui.add(world.size,'height', 1, 128, 1).name('Height');


    const terrainFolder = gui.addFolder('Terrain');
    terrainFolder.add(world.params, 'seed', 0, 1000).name('Seed');
    terrainFolder.add(world.params.terrain, 'scale', 10, 100).name('Scale');
    terrainFolder.add(world.params.terrain, 'offset', 0, 1).name('Offset');
    terrainFolder.add(world.params.terrain, 'magnitude', 0, 1).name('Magnitude');

    gui.onChange( () => {
        world.generate();
    })
}
