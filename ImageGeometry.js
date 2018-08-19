"use strict";

//Check if three.js is included
if(window.THREE === undefined)
{
	console.error("THREE.ImageGeometry: three.js is required for this library to work.");
}

/** 
 * ImageGeometry used to create triangulated geometry from alpha image.
 *
 * @class ImageGeometry
 * @param {DOM} Img URL.
 */
function ImageGeometry(source)
{
	THREE.BufferGeometry.call(this);

	/**
	 * Threshold to conside a pixel transparent of opaque.
	 *
	 * Value between 0 and 255.
	 *
	 * @property threshold
	 * @type {Number}
	 */
	this.threshold = 40;

	/**
	 * Density of the generated geometry in percentage.
	 *
	 * Bigger value means more triangles.
	 *
	 * Value between 0 and 1.
	 * 
	 * @property desity.
	 * @type {Number}
	 */
	this.density = 1;
}

ImageGeometry.prototype = Object.create(THREE.BufferGeometry.prototype);

/**
 * Load image from URL and create geometry.
 *
 * @method load
 * @param {String} url Image URL
 * @param {Function} onLoad On load callback.
 */
ImageGeometry.prototype.load = function(url, onLoad)
{
	var self = this;

	var image = document.createElement("img");
	image.src = source;
	image.style.position = "absolute";
	image.style.zIndex = "100";
	image.style.height = "50%";
	image.onload = function()
	{
		self.generate(image);		
		onLoad(self);
	};
	
	document.body.appendChild(image);
};

/**
 * Generate geometry from image element.
 *
 * @method generate
 * @param {DOM} image DOM image element.
 */
ImageGeometry.prototype.generate = function(image)
{
	var self = this;
	
	//Create canvas
	var canvas = document.createElement("canvas");
	canvas.width = image.naturalWidth;
	canvas.height = image.naturalHeight;

	//Draw image
	var context = canvas.getContext("2d");
	context.drawImage(image, 0, 0);

	var data = context.getImageData(0, 0, canvas.width, canvas.height).data;
	generateGeometry(triangulateImage(data, this.threshold));

	function vectorsClockWise(p1, p2, p3)
	{
		var val = (p2.y - p1.y) * (p3.x - p2.x) - (p2.x - p1.x) * (p3.y - p2.y);

		return val >= 0;
	}

	function sortTriangle(triangle)
	{
		if(vectorsClockWise(triangle.a, triangle.b, triangle.c))
		{
			var temp = triangle.a;
			triangle.a = triangle.b;
			triangle.b = temp;
		}
	}

	function triangulateImage(data, threshold)
	{
		//List of regions extracted from the image
		var regions = [];
		
		//Transitions from the last row
		var lastTransitions = 0;

		//Analyse image detect regions and extract points
		for(var y = 0; y < canvas.height; y ++)
		{
			var transitions = 0;
			var currentTransparent = true;
			var points = [];

			for(var x = 0; x < canvas.width; x++)
			{
				var i = calcIndex(x, y);

				var isTransparent = data[i + 3] < threshold;

				//Transition
				if(currentTransparent !== isTransparent)
				{
					transitions++;
					currentTransparent = isTransparent;
					points.push(new THREE.Vector3(x, canvas.height - y, 0));
				}
				//Last pixel
				else if(x === canvas.width - 1)
				{
					if(isTransparent === false)
					{
						transitions++;
						points.push(new THREE.Vector3(x, canvas.height - y, 0));
					}
				}
			}

			//If number of transitions is different create a new regions region
			if(transitions !== lastTransitions)
			{
				if(transitions !== 0)
				{
					//Create new region
					regions.push(
					{
						start: y,
						end: y,
						points: [points],
						transitions: transitions
					});
				}

				lastTransitions = transitions;
			}
			//Else update the end point of the current region
			else if(regions.length > 0 && transitions !== 0)
			{
				regions[regions.length - 1].end = y;
				regions[regions.length - 1].points.push(points);
			}
		}

		//Array of THREE.Triangle
		var triangles = [];

		//Find min and max transitions
		var minTransitions = regions[0].transitions;
		var maxTransitions = regions[0].transitions;

		for(var l = 0; l < regions.length; l++)
		{	
			//Fill gaps between regions
			if(l < regions.length - 1)
			{
				//Compare last point of the current region, to check if they are sequential
				if(regions[l + 1].start - regions[l].end === 1)
				{
					var firstPoints = regions[l].points[regions[l].points.length - 1];
					var newPoints = [];

					for(var o = 0; o < firstPoints.length; o++)
					{
						var point = firstPoints[o].clone();
						point.y += 1;
						newPoints.push(point);
					}

					regions[l].points.push(newPoints);
				} 
			}

			//Min transitions
			if(regions[l].transitions < minTransitions)
			{
				minTransitions = regions[l].transitions;
			}

			//Max trasitions
			if(regions[l].transitions > maxTransitions)
			{
				maxTransitions = regions[l].transitions;
			}
		}
		
		//Offset transitions to match index
		maxTransitions -= minTransitions;
		minTransitions = 0;

		//console.log("Regions: ", regions);
		//console.log("Indexes: ", minTransitions, maxTransitions);
		
		//Iterate trought number of transitions
		for(var k = minTransitions; k < maxTransitions; k += 2)
		{
			for(var l = 0; l < regions.length; l++)
			{
				//Array of THREE.Vector3, used to create triangles
				var points = [];

				//Step size
				var step;
				if(regions[l].points.length < 3)
				{
					step = 1;
				}
				else
				{
					step = regions[l].points.length - 1;
					while(step > 1 && (step % (regions[l].points.length - 1)) !== 0)
					{
						step--;
					}
				}

				//Iterate points of the line in the region
				function processLine(linePoints)
				{
					for(var m = k; m < linePoints.length && m < (k + 2); m++)
					{
						points.push(linePoints[m]);
						
						while(points.length > 3)
						{
							points.shift();
						}

						if(points.length === 3)
						{
							var triangle = new THREE.Triangle(points[0], points[1], points[2]);
							sortTriangle(triangle);
							triangles.push(triangle);
						}
					}
				}

				//Iterate points of the region
				for(var x = 0; x < regions[l].points.length; x += step)
				{
					processLine(regions[l].points[x]);
				}
			}
		}

		return triangles;
	}

	//Calculate the bounding box of the image.
	function calculateBoundingBox(data, threshold)
	{
		var origin = new THREE.Vector2(canvas.width, canvas.height);
		var end  = new THREE.Vector2(0, 0);

		for(var y = 0; y < canvas.height; y ++)
		{
			for(var x = 0; x < canvas.width; x++)
			{
				var i = calcIndex(x, y);

				if(data[i + 3] > threshold)
				{
					if(x > end.x) end.x = x;
					if(y > end.y) end.y = y;
					if(x < origin.x) origin.x = x;
					if(y < origin.y) origin.y = y;
				}
			}
		}

		return {origin: origin, end: end};
	}

	//Generate THREE.BufferGeometry from triangles array.
	function generateGeometry(triangles)
	{
		var uvs = [];
		var vertices = [];
		var normals = [];
		var faces = [];

		function addVector(vector)
		{
			var scale = image.naturalWidth;
			vertices.push(vector.x / scale, vector.y / scale, vector.z / scale);
			normals.push(0, -1, 0);
			uvs.push(vector.x / image.naturalWidth, vector.y / image.naturalHeight);
		}

		for(var i = 0; i < triangles.length; i++)
		{
			addVector(triangles[i].a);
			addVector(triangles[i].b);
			addVector(triangles[i].c);
		}

		self.addAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
		self.addAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
		self.addAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
	}

	function calcIndex(x, y)
	{
		return (x * 4) + (y * canvas.width * 4);
	}

	function calcCoord(index)
	{
		return {x: (index / 4) % canvas.width, y: Math.floor((index / 4) / canvas.width)};
	}
};

//Draw the regions into a canvas
ImageGeometry.debugRegions = function(canvas, regions)
{
	var context = canvas.getContext("2d");

	for(var i = 0; i < regions.length; i++)
	{
		//Start line
		context.strokeStyle = "#0000FF";
		context.beginPath();
		context.moveTo(0, regions[i].start);
		context.lineTo(canvas.width, regions[i].start);
		context.stroke();

		var startPoints = regions[i].points[0];

		//Start points
		for(var j = 0; j < startPoints.length; j++)
		{
			context.fillStyle = "#FF0000";
			context.beginPath();
			context.arc(startPoints[j].x, regions[i].start, 3, 0, 2*Math.PI);
			context.fill();
		}

		//End line
		context.strokeStyle = "#00FF00";
		context.beginPath();
		context.moveTo(0, regions[i].end);
		context.lineTo(canvas.width, regions[i].end);
		context.stroke();

		var endPoints = regions[i].points[regions[i].points.length - 1];

		//End points
		for(var j = 0; j < endPoints.length; j++)
		{
			context.fillStyle = "#FFFF00";
			context.beginPath();
			context.arc(endPoints[j].x, regions[i].end, 3, 0, 2*Math.PI);
			context.fill();
		}
	}
};

//Draw triangle to a canvas
ImageGeometry.debugTriangles = function(canvas, triangles)
{
	var context = canvas.getContext("2d");
	context.strokeStyle = "#00FF00";
	context.beginPath();
	for(var i = 0; i < triangles.length; i++)
	{
		var triangle = triangles[i];
		context.moveTo(triangle.a.x, triangle.a.y);
		context.lineTo(triangle.b.x, triangle.b.y);
		context.lineTo(triangle.c.x, triangle.c.y);
		context.lineTo(triangle.a.x, triangle.a.y);
	}
	context.stroke();
};
