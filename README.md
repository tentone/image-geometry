# ImageGeometry
 - A simple 2D geometry generator for threejs.
 - Receives a image with alpha channel and calculated a mesh to fit that image.
 - Can be usefull for instancing shadowed 2D elements like fur or vegetation.

## Example


## Algorithm
 - The algorithm goes through each horizontal line of the image.
 - The imagem is divided into region with a single entry and exit point.
 - Each region is triangulated using a zig-zag pattern.

## Usage
```
var geometry = new ImageGeometry();
geometry.load("image.png", function(geometry)
{
	//DO SOMETHING
});
```

## License
 - MIT License (Attached to the repository).
