
/**
 * @file A simple WebGL example drawing central Illinois style terrain
 * @author Eric Shaffer <shaffer1@illinois.edu>  
 */

/** @global The WebGL context */
var gl;

/** @global The HTML5 canvas we draw on */
var canvas;

/** @global A simple GLSL shader program */
var shaderProgram;

/** @global a GLSL shader program for skybox */
var skyboxShaderProgram;

/** @global The Modelview matrix */
var mvMatrix = glMatrix.mat4.create();

/** @global The Projection matrix */
var pMatrix = glMatrix.mat4.create();

/** @global The Normal matrix */
var nMatrix = glMatrix.mat3.create();

/** @global A glMatrix vector to use for transformations */
var transformVec = glMatrix.vec3.create();    

// Initialize the vector....
glMatrix.vec3.set(transformVec,0.0,0.0,-2.0);

/** @global An object holding the geometry for a 3D terrain */
var myTerrain;


// View parameters
/** @global Location of the camera in world coordinates */
var eyePt = glMatrix.vec3.fromValues(0.0,0.0,0.0);
/** @global Direction of the view in world coordinates */
var viewDir = glMatrix.vec3.fromValues(0.0,0.0,-1.0);
/** @global Up vector for view matrix creation, in world coordinates */
var up = glMatrix.vec3.fromValues(0.0,1.0,0.0);
/** @global Location of a point along viewDir in world coordinates */
var viewPt = glMatrix.vec3.fromValues(100,-200.0,-100.0);

//Light parameters
/** @global Light position in X-VIEW-X coordinates */
var lightPosition = [1,1,1];
/** @global Ambient light color/intensity for Phong reflection */
var lAmbient = [1,1,1];
/** @global Diffuse light color/intensity for Phong reflection */
var lDiffuse = [1,1,1];
/** @global Specular light color/intensity for Phong reflection */
var lSpecular =[1,1,1];

//Material parameters
/** @global Ambient material color/intensity for Phong reflection */
var kAmbient = [0.7,0.4,0.5];
/** @global Diffuse material color/intensity for Phong reflection */
var kTerrainDiffuse = [205.0/255.0,163.0/255.0,63.0/255.0];
/** @global Specular material color/intensity for Phong reflection */
var kSpecular = [0.5,0.5,0.5];
/** @global Shininess exponent for Phong reflection */
var shininess = 23;
/** @global Edge color fpr wireframeish rendering */
var kEdgeBlack = [0.0,0.0,0.0];
/** @global Edge color for wireframe rendering */
var kEdgeWhite = [1.0,1.0,1.0];

/** @global maxZ for any vertex in the partition */
var maxZ = 1.0;
/** @global minZ for any vertex in the partition */
var minZ = -1.0;

/** @global The buffer that stores the positions of the skybox */
var positionBuffer;

/** @global location of skybox in shader program */
var skyboxLocation;
/** @global location of the inverse of the projection-view matrix in shader program */
var viewDirectionProjectionInverseLocation;
/** @global location of aVertexPosition in shader program */
var positionLocation;
/** @global mesh of the teapot */
var teapot;
/** @global mode of the shader: 0 - phong, 1 - reflection, 2 - refraction */
var shaderMode = 0;

/** @global reverse of mvMatrix */
var uRMatrix = glMatrix.mat4.create();

/** @global decides which skybox should be used */
var control = 0;



//-------------------------------------------------------------------------
/**
 * Sends Modelview matrix to shader
 */
function uploadModelViewMatrixToShader() {
  gl.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, mvMatrix);
}

//-------------------------------------------------------------------------
/**
 * Sends projection matrix to shader
 */
function uploadProjectionMatrixToShader() {
  gl.uniformMatrix4fv(shaderProgram.pMatrixUniform, 
                      false, pMatrix);
}

//-------------------------------------------------------------------------
/**
 * Generates and sends the normal matrix to the shader
 */
function uploadNormalMatrixToShader() {
  glMatrix.mat3.fromMat4(nMatrix,mvMatrix);
  glMatrix.mat3.transpose(nMatrix,nMatrix);
  glMatrix.mat3.invert(nMatrix,nMatrix);
  gl.uniformMatrix3fv(shaderProgram.nMatrixUniform, false, nMatrix);
}

//----------------------------------------------------------------------------------
/**
 * Sends projection/modelview matrices to shader
 */
function setMatrixUniforms() {
    gl.useProgram(shaderProgram);
    uploadModelViewMatrixToShader();
    uploadNormalMatrixToShader();
    uploadProjectionMatrixToShader();
    // gl.uniformMatrix4fv(shaderProgram.rMatrixUniform, false, uRMatrix);
    // gl.uniform3fv(shaderProgram.camera, cameraPosition);
    gl.uniformMatrix4fv(shaderProgram.skyboxMV, false, viewMatrix);
}

//----------------------------------------------------------------------------------
/**
 * Translates degrees to radians
 * @param {Number} degrees Degree input to function
 * @return {Number} The radians that correspond to the degree input
 */
function degToRad(degrees) {
        return degrees * Math.PI / 180;
}

//----------------------------------------------------------------------------------
/**
 * Creates a context for WebGL
 * @param {element} canvas WebGL canvas
 * @return {Object} WebGL context
 */
/**
 * Creates a context for WebGL
 * @param {element} canvas WebGL canvas
 * @return {Object} WebGL context
 */
function createGLContext(canvas) {
  var context = null;
  context = canvas.getContext("webgl");
  if (context) {
    context.viewportWidth = canvas.width;
    context.viewportHeight = canvas.height;
  } else {
    alert("Failed to create WebGL context!");
  }
  return context;
}

//----------------------------------------------------------------------------------
/**
 * Loads Shaders
 * @param {string} id ID string for shader to load. Either vertex shader/fragment shader
 */
function loadShaderFromDOM(id) {
var shaderScript = document.getElementById(id);
  
  // If we don't find an element with the specified id
  // we do an early exit 
  if (!shaderScript) {
    return null;
  }
    
  var shaderSource = shaderScript.text;
 
  var shader;
  if (shaderScript.type == "x-shader/x-fragment") {
    shader = gl.createShader(gl.FRAGMENT_SHADER);
  } else if (shaderScript.type == "x-shader/x-vertex") {
    shader = gl.createShader(gl.VERTEX_SHADER);
  } else {
    return null;
  }
 
  gl.shaderSource(shader, shaderSource);
  gl.compileShader(shader);
 
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert(gl.getShaderInfoLog(shader));
    return null;
  } 
  return shader; 
}

//----------------------------------------------------------------------------------
/**
 * Setup the fragment and vertex shaders
 */
function setupSkyboxShaders() {
  vertexShader = loadShaderFromDOM("shader-skybox-vs");
  fragmentShader = loadShaderFromDOM("shader-skybox-fs");
  
  skyboxShaderProgram = gl.createProgram();
  gl.attachShader(skyboxShaderProgram, vertexShader);
  gl.attachShader(skyboxShaderProgram, fragmentShader);
  gl.linkProgram(skyboxShaderProgram);

  if (!gl.getProgramParameter(skyboxShaderProgram, gl.LINK_STATUS)) {
    alert("Failed to setup shaders");
  }

  gl.useProgram(skyboxShaderProgram);

  skyboxShaderProgram.vertexPositionAttribute = gl.getAttribLocation(skyboxShaderProgram, "aVertexPosition");
  positionLocation = skyboxShaderProgram.vertexPositionAttribute;
  gl.enableVertexAttribArray(skyboxShaderProgram.vertexPositionAttribute);

  // lookup uniforms
  skyboxLocation = gl.getUniformLocation(skyboxShaderProgram, "u_skybox");
  viewDirectionProjectionInverseLocation =
      gl.getUniformLocation(skyboxShaderProgram, "u_viewDirectionProjectionInverse");
}

function setupShaders() {
    vertexShader = loadShaderFromDOM("shader-vs");
  fragmentShader = loadShaderFromDOM("shader-fs");
  
  shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    alert("Failed to setup shaders");
  }

  gl.useProgram(shaderProgram);

  shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
  positionLocation = shaderProgram.vertexPositionAttribute;
  gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);

  shaderProgram.vertexNormalAttribute = gl.getAttribLocation(shaderProgram, "aVertexNormal");
  gl.enableVertexAttribArray(shaderProgram.vertexNormalAttribute);

  shaderProgram.mvMatrixUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");
  shaderProgram.rMatrixUniform = gl.getUniformLocation(shaderProgram, "uRMatrix");
  shaderProgram.pMatrixUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");
  shaderProgram.nMatrixUniform = gl.getUniformLocation(shaderProgram, "uNMatrix");
  shaderProgram.uniformLightPositionLoc = gl.getUniformLocation(shaderProgram, "uLightPosition");    
  shaderProgram.uniformAmbientLightColorLoc = gl.getUniformLocation(shaderProgram, "uAmbientLightColor");  
  shaderProgram.uniformDiffuseLightColorLoc = gl.getUniformLocation(shaderProgram, "uDiffuseLightColor");
  shaderProgram.uniformSpecularLightColorLoc = gl.getUniformLocation(shaderProgram, "uSpecularLightColor");
  shaderProgram.uniformShininessLoc = gl.getUniformLocation(shaderProgram, "uShininess");    
  shaderProgram.uniformAmbientMaterialColorLoc = gl.getUniformLocation(shaderProgram, "uAmbientMaterialColor");  
  shaderProgram.uniformDiffuseMaterialColorLoc = gl.getUniformLocation(shaderProgram, "uDiffuseMaterialColor");
  shaderProgram.uniformSpecularMaterialColorLoc = gl.getUniformLocation(shaderProgram, "uSpecularMaterialColor");
  shaderProgram.uMode = gl.getUniformLocation(shaderProgram, "uMode");
  shaderProgram.cube = gl.getUniformLocation(shaderProgram,"texMap");
  shaderProgram.camera = gl.getUniformLocation(shaderProgram, "cameraPosition");
  shaderProgram.skyboxMV = gl.getUniformLocation(shaderProgram, "uSkyboxMV");
}

//-------------------------------------------------------------------------
/**
 * Sends material information to the shader
 * @param {Float32} alpha shininess coefficient
 * @param {Float32Array} a Ambient material color
 * @param {Float32Array} d Diffuse material color
 * @param {Float32Array} s Specular material color
 */
function setMaterialUniforms(alpha,a,d,s) {
  gl.uniform1f(shaderProgram.uniformShininessLoc, alpha);
  gl.uniform3fv(shaderProgram.uniformAmbientMaterialColorLoc, a);
  gl.uniform3fv(shaderProgram.uniformDiffuseMaterialColorLoc, d);
  gl.uniform3fv(shaderProgram.uniformSpecularMaterialColorLoc, s);

  gl.uniform1f(shaderProgram.minZLoc, minZ);
  gl.uniform1f(shaderProgram.maxZLoc, maxZ);
  gl.uniform1f(shaderProgram.uMode, shaderMode);
  gl.uniform1i(shaderProgram.cube, texturee);
}

//-------------------------------------------------------------------------
/**
 * Sends light information to the shader
 * @param {Float32Array} loc Location of light source
 * @param {Float32Array} a Ambient light strength
 * @param {Float32Array} d Diffuse light strength
 * @param {Float32Array} s Specular light strength
 */
function setLightUniforms(loc,a,d,s) {
  gl.uniform3fv(shaderProgram.uniformLightPositionLoc, loc);
  gl.uniform3fv(shaderProgram.uniformAmbientLightColorLoc, a);
  gl.uniform3fv(shaderProgram.uniformDiffuseLightColorLoc, d);
  gl.uniform3fv(shaderProgram.uniformSpecularLightColorLoc, s);
}

//----------------------------------------------------------------------------------
/**
 * Populate buffers with data
 */
function setupBuffers() {
    // Create a buffer for positions
    positionBuffer = gl.createBuffer();
    // Bind it to ARRAY_BUFFER (think of it as ARRAY_BUFFER = positionBuffer)
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    // Put the positions in the buffer
    setGeometry(gl);
    setupSkyboxTexture(0);
}

/** @global position buffer for my own skybox */
var positionBuffer1;
function setupBuffers1(control) {
  // Create a buffer for positions
  positionBuffer1 = gl.createBuffer();
  // Bind it to ARRAY_BUFFER (think of it as ARRAY_BUFFER = positionBuffer)
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer1);
  // Put the positions in the buffer
  setGeometry(gl);
  setupSkyboxTexture(1);
}

/** @global stores the texture */
var texturee;
function setupSkyboxTexture(control) {
    // Create a texture.
  var texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);

  var faceInfos = [
    {
      target: gl.TEXTURE_CUBE_MAP_POSITIVE_X,
      url: 'pos-x.png',
    },
    {
      target: gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
      url: 'neg-x.png',
    },
    {
      target: gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
      url: 'pos-y.png',
    },
    {
      target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
      url: 'neg-y.png',
    },
    {
      target: gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
      url: 'pos-z.png',
    },
    {
      target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Z,
      url: 'neg-z.png',
    },
  ];

  console.log(control);
  if (control == 0) {
    faceInfos = [
      {
        target: gl.TEXTURE_CUBE_MAP_POSITIVE_X,
        url: 'pos-x.png',
      },
      {
        target: gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
        url: 'neg-x.png',
      },
      {
        target: gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
        url: 'pos-y.png',
      },
      {
        target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
        url: 'neg-y.png',
      },
      {
        target: gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
        url: 'pos-z.png',
      },
      {
        target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Z,
        url: 'neg-z.png',
      },
    ];
  } else {
    console.log("we are here");
    faceInfos = [
      {
        target: gl.TEXTURE_CUBE_MAP_POSITIVE_X,
        url: 'Skybox/pos-x.png',
      },
      {
        target: gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
        url: 'Skybox/neg-x.png',
      },
      {
        target: gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
        url: 'Skybox/pos-y.png',
      },
      {
        target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
        url: 'Skybox/neg-y.png',
      },
      {
        target: gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
        url: 'Skybox/pos-z.png',
      },
      {
        target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Z,
        url: 'Skybox/neg-z.png',
      },
    ];
  }

  faceInfos.forEach((faceInfo) => {
    const {target, url} = faceInfo;

    // Upload the canvas to the cubemap face.
    const level = 0;
    const internalFormat = gl.RGBA;
    var width = 512;
    var height = 512;
    if (control == 0) {
      width = 512;
      height = 512;
    } else {
      width = 128;
      height = 128;
    }
    const format = gl.RGBA;
    const type = gl.UNSIGNED_BYTE;

    // setup each face so it's immediately renderable
    gl.texImage2D(target, level, internalFormat, width, height, 0, format, type, null);

    // Asynchronously load an image
    const image = new Image();
    image.src = url;
    image.addEventListener('load', function() {
      // Now that the image has loaded make copy it to the texture.
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
      gl.texImage2D(target, level, internalFormat, format, type, image);
      gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
      texturee = texture;
    });
  });
  gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
}

/** @global angle to rotate skybox by */
var rotAngle = 0;

/** @global angle to rotate teapot by */
var rotTea = 0;

/** @global position of camera in world */
var cameraPosition = glMatrix.mat4.create();

/** @global MV matrix of skybox */
var viewMatrix = glMatrix.mat4.create();

//----------------------------------------------------------------------------------
/**
 * Draw call that applies matrix transformations to model and draws model in frame
 */
function draw() {
    control = document.getElementById("skybox-london");
    // console.log(control.checked);
    // if (control.checked) {
    //   // console.log("here");
    //   setupBuffers();
    // } else {
    //   setupBuffers1();
    // }

    if (currentlyPressedKeys["ArrowRight"] == true) {
      rotAngle += -0.01
    }
    if (currentlyPressedKeys["ArrowLeft"] == true) {
      rotAngle += 0.01
    }
    if (currentlyPressedKeys["a"] == true) {
      rotTea += -1
    }
    if (currentlyPressedKeys["d"] == true) {
      rotTea += 1
    }

    var modes = document.getElementsByName("shader");
    for (var i = 0; i < 3; i++) {
      if (modes[i].checked) {
        shaderMode = i;
      }
    }

    gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);

    // gl.disableVertexAttribArray(skyboxShaderProgram.camera);

    // Tell WebGL how to convert from clip space to pixels
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);

    // Clear the canvas AND the depth buffer.
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Compute the projection matrix
    var transformVec = glMatrix.vec3.create();
  
    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // We'll use perspective 
    glMatrix.mat4.perspective(pMatrix,degToRad(60), 
                     gl.viewportWidth / gl.viewportHeight,
                     0.1, 400);

    // We want to look down -z, so create a lookat point in that direction    
    glMatrix.vec3.add(viewPt, eyePt, viewDir);
    // Then generate the lookat matrix and initialize the MV matrix to that view
    cameraMatrix = glMatrix.mat4.create();
    var up = [0,1,0];
    glMatrix.mat4.lookAt(cameraMatrix,eyePt,viewPt,up);
    glMatrix.mat4.invert(mvMatrix,cameraMatrix);  
    // glMatrix.vec3.multiply(lightPosition, mvMatrix, lightPosition); 
    glMatrix.mat4.invert(uRMatrix,mvMatrix);
    // glMatrix.vec3.multiply(lightPosition, cameraMatrix, lightPosition);
 
    //Draw mesh
    glMatrix.vec3.set(transformVec,-0.3,-1,-10);
    glMatrix.mat4.translate(mvMatrix, mvMatrix,transformVec);
    glMatrix.mat4.rotateY(mvMatrix, mvMatrix, degToRad(rotTea));

    if (teapot.isLoaded == true) {
      // glMatrix.vec3.multiply(lightPosition, mvMatrix, lightPosition);
      setMatrixUniforms();
      setLightUniforms(lightPosition,lAmbient,lDiffuse,lSpecular);

      setMaterialUniforms(shininess,kAmbient,kTerrainDiffuse,kSpecular); 
      teapot.drawTriangles();
    }

    gl.disableVertexAttribArray(shaderProgram.vertexPositionAttribute);

    gl.useProgram(skyboxShaderProgram);
    // Bind the position buffer.
    if (control.checked) {
      // console.log("hereee");
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    } else {
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer1);
    }

    // Then generate the lookat matrix and initialize the MV matrix to that view
    // camera going in circle 2 units from origin looking at origin
    // var cameraPosition = [Math.cos(xAxis), 0, Math.sin(xAxis)];
    cameraPosition = [Math.cos(rotAngle), 0, Math.sin(rotAngle)];
    lightPosition = [Math.cos(rotAngle), 0, Math.sin(rotAngle)];
    var target = [0, 0, 0];
    up = [0, 1, 0];
    // Compute the camera's matrix using look at.
    var cameraMatrix1 = glMatrix.mat4.create();
    glMatrix.mat4.lookAt(cameraMatrix1,cameraPosition, target, up);
    // console.log(lightPosition);

    // Make a view matrix from the camera matrix.
    viewMatrix = glMatrix.mat4.create();
    glMatrix.mat4.invert(viewMatrix,cameraMatrix1);
    // glMatrix.vec3.transformMat4(lightPosition, lightPosition, viewMatrix);

    // We only care about direciton so remove the translation
    viewMatrix[12] = 0;
    viewMatrix[13] = 0;
    viewMatrix[14] = 0;

    var viewDirectionProjectionMatrix = glMatrix.mat4.create();
    glMatrix.mat4.multiply(viewDirectionProjectionMatrix,pMatrix, viewMatrix);
    var viewDirectionProjectionInverseMatrix = glMatrix.mat4.create();
    glMatrix.mat4.invert(viewDirectionProjectionInverseMatrix,viewDirectionProjectionMatrix);

    // Tell the position attribute how to get data out of positionBuffer (ARRAY_BUFFER)
    var size = 2;          // 2 components per iteration
    var type = gl.FLOAT;   // the data is 32bit floats
    var normalize = false; // don't normalize the data
    var stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
    var offset = 0;        // start at the beginning of the buffer
    gl.vertexAttribPointer(
        positionLocation, size, type, normalize, stride, offset);
    
        // Set the uniforms
        gl.uniformMatrix4fv(
            viewDirectionProjectionInverseLocation, false,
            viewDirectionProjectionInverseMatrix);
    
        // Tell the shader to use texture unit 0 for u_skybox
        gl.uniform1i(skyboxLocation, 0);
    
        // let our quad pass the depth test at 1.0
        gl.depthFunc(gl.LEQUAL);
        gl.useProgram(skyboxShaderProgram);

    gl.drawArrays(gl.TRIANGLES, 0, 1 * 6);

    requestAnimationFrame(draw);
}

function setupSkybox() {
    setupSkyboxShaders();
    setupBuffers1();
    setupBuffers();
}

//----------------------------------------------------------------------------------
/**
 * Startup function called from html code to start program.
 */
 function startup() {
  canvas = document.getElementById("myGLCanvas");
  gl = createGLContext(canvas);
  setupShaders();
  setupMesh();
  setupSkybox();
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.enable(gl.DEPTH_TEST);
  document.onkeydown = handleKeyDown;
  document.onkeyup = handleKeyUp;
  requestAnimationFrame(draw); 
}

/**
 * Fill the buffer with the values that define a quad.
 */
function setGeometry(gl) {
    var positions = new Float32Array(
      [
        -1, -1,
         1, -1,
        -1,  1,
        -1,  1,
         1, -1,
         1,  1,
      ]);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
  }

/**
 * Gets a file from the server for processing on the client side.
 *
 * @param  file A string that is the name of the file to get
 * @param  callbackFunction The name of function (NOT a string) that will receive a string holding the file
 *         contents.
 *
 */
function readTextFile(file, callbackFunction)
{
    console.log("reading "+ file);
    var rawFile = new XMLHttpRequest();
    var allText = [];
    rawFile.open("GET", file, true);
    
    rawFile.onreadystatechange = function ()
    {
        if(rawFile.readyState === 4)
        {
            if(rawFile.status === 200 || rawFile.status == 0)
            {
                teapot = new TriMesh();
                //  callbackFunction(rawFile.responseText);
                teapot.loadFromOBJ(rawFile.responseText);
                 console.log("Got text file!");
            }
        }
    }
    rawFile.send(null);
}

/**
 * Load the teapot
 */
function setupMesh() {
    teapot = new TriMesh();
    readTextFile("https://raw.githubusercontent.com/illinois-cs418/cs418CourseMaterial/master/Meshes/teapot_0.obj", teapot.loadFromOBJ);
}

/** @global dictionary that stores whether a key is pressed down or up */
var currentlyPressedKeys = {};

/** 
 * handles user input when key is pressed down
 * @param event contains the information of the event that occurred.
 */
function handleKeyDown(event) {
  // console.log("Key down ", event.key, " code ", event.code);
  if (event.key == "ArrowLeft" || event.key == "ArrowRight" || event.key == "a" || event.key == "d") {
    event.preventDefault();
  }
  currentlyPressedKeys[event.key] = true;
}

/** 
 * handles user input when key is pressed down
 * @param event contains the information of the event that occurred.
 */
function handleKeyUp(event) {
  //console.log("Key up ", event.key, " code ", event.code);
  currentlyPressedKeys[event.key] = false;
}