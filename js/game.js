var requestAnimFrame = (function(){
  return window.requestAnimationFrame       ||
    window.webkitRequestAnimationFrame ||
    window.mozRequestAnimationFrame    ||
    window.oRequestAnimationFrame      ||
    window.msRequestAnimationFrame     ||
    function(callback){
      window.setTimeout(callback, 1000 / 60);
    };
})();

//create the canvas
var canvas = document.createElement("canvas");
var ctx = canvas.getContext('2d');
var updateables = [];
var fireballs = [];
var player = new Mario.Player([0,0]);
var controlButtons = [];
var score = 0;
var highScore = 0;
var scoreValueEl;
var highScoreValueEl;

//we might have to get the size and calculate the scaling
//but this method should let us make it however big.
//Cool!
//TODO: Automatically scale the game to work and look good on widescreen.
//TODO: fiddling with scaled sprites looks BETTER, but not perfect. Hmm.
canvas.width = 762;
canvas.height = 720;
ctx.scale(3,3);
document.body.appendChild(canvas);
createControls();
createHUD();

function createControlButton(text, className, key) {
  var button = document.createElement('button');
  button.className = className;
  button.textContent = text;
  var start = function(e) {
    e.preventDefault();
    input.setKeyStatus(key, true);
  };
  var end = function(e) {
    e.preventDefault();
    input.setKeyStatus(key, false);
  };
  ['touchstart', 'mousedown'].forEach(function(evt) {
    button.addEventListener(evt, start);
  });
  ['touchend', 'touchcancel', 'mouseup', 'mouseleave'].forEach(function(evt) {
    button.addEventListener(evt, end);
  });
  controlButtons.push(button);
  return button;
}

function createControls() {
  var container = document.createElement('div');
  container.className = 'touch-controls';

  var joystick = document.createElement('div');
  joystick.className = 'touch-joystick';
  joystick.appendChild(createControlButton('\u25C0', 'touch-button left', 'LEFT'));
  joystick.appendChild(createControlButton('\u25B6', 'touch-button right', 'RIGHT'));

  var jump = document.createElement('div');
  jump.className = 'touch-jump';
  jump.appendChild(createControlButton('A', 'touch-button jump', 'JUMP'));

  container.appendChild(joystick);
  container.appendChild(jump);
  document.body.appendChild(container);

  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
    document.body.classList.add('touch-enabled');
    container.style.opacity = 1;
    container.style.visibility = 'visible';
  }
}

function createHUD() {
  var hud = document.createElement('div');
  hud.className = 'hud';

  var scoreContainer = document.createElement('div');
  var scoreLabel = document.createElement('div');
  scoreLabel.className = 'label';
  scoreLabel.textContent = 'Score';
  scoreValueEl = document.createElement('div');
  scoreValueEl.className = 'value';
  scoreValueEl.textContent = '0';
  scoreContainer.appendChild(scoreLabel);
  scoreContainer.appendChild(scoreValueEl);

  var highContainer = document.createElement('div');
  var highLabel = document.createElement('div');
  highLabel.className = 'label';
  highLabel.textContent = 'High Score';
  highScoreValueEl = document.createElement('div');
  highScoreValueEl.className = 'value';
  highScoreValueEl.textContent = '0';
  highContainer.appendChild(highLabel);
  highContainer.appendChild(highScoreValueEl);

  hud.appendChild(scoreContainer);
  hud.appendChild(highContainer);
  document.body.appendChild(hud);

  try {
    highScore = parseInt(window.localStorage.getItem('marioHighScore')) || 0;
  } catch (e) {
    highScore = 0;
  }
  updateScoreDisplay();
}

//viewport
var vX = 0,
    vY = 0,
    vWidth = 256,
    vHeight = 240;

//load our images
resources.load([
  'sprites/player.png',
  'sprites/enemy.png',
  'sprites/tiles.png',
  'sprites/playerl.png',
  'sprites/items.png',
  'sprites/enemyr.png',
]);

resources.onReady(init);
var level;
var sounds;
var music;

function createAudioWithFallback(options) {
  var probe = document.createElement('audio');
  for (var i = 0; i < options.length; i++) {
    var option = options[i];
    if (!option.src) {
      continue;
    }
    if (!option.type || probe.canPlayType(option.type)) {
      return new Audio(option.src);
    }
  }
  return new Audio();
}

//initialize
var lastTime;
function init() {
  music = {
    overworld: createAudioWithFallback([
      { src: (AUDIO_DATA && AUDIO_DATA.overworld) || '', type: 'audio/mpeg' },
      { src: 'sounds/aboveground_bgm.ogg', type: 'audio/ogg' }
    ]),
    underground: createAudioWithFallback([
      { src: (AUDIO_DATA && AUDIO_DATA.underground) || '', type: 'audio/mpeg' },
      { src: 'sounds/underground_bgm.ogg', type: 'audio/ogg' }
    ]),
    clear: new Audio('sounds/stage_clear.wav'),
    death: new Audio('sounds/mariodie.wav')
  };
  sounds = {
    smallJump: new Audio('sounds/jump-small.wav'),
    bigJump: new Audio('sounds/jump-super.wav'),
    breakBlock: new Audio('sounds/breakblock.wav'),
    bump: new Audio('sounds/bump.wav'),
    coin: new Audio('sounds/coin.wav'),
    fireball: new Audio('sounds/fireball.wav'),
    flagpole: new Audio('sounds/flagpole.wav'),
    kick: new Audio('sounds/kick.wav'),
    pipe: new Audio('sounds/pipe.wav'),
    itemAppear: new Audio('sounds/itemAppear.wav'),
    powerup: new Audio('sounds/powerup.wav'),
    stomp: new Audio('sounds/stomp.wav')
  };
  Mario.oneone();
  score = 0;
  gameTime = 0;
  updateScoreDisplay();
  lastTime = Date.now();
  main();
}

var gameTime = 0;

//set up the game loop
function main() {
  var now = Date.now();
  var dt = (now - lastTime) / 1000.0;

  update(dt);
  render();

  lastTime = now;
  requestAnimFrame(main);
}

function update(dt) {
  gameTime += dt;

  handleInput(dt);
  updateEntities(dt, gameTime);

  checkCollisions();
}

function handleInput(dt) {
  if (player.piping || player.dying || player.noInput) return; //don't accept input

  if (input.isDown('RUN')){
    player.run();
  } else {
    player.noRun();
  }
  if (input.isDown('JUMP')) {
    player.jump();
  } else {
    //we need this to handle the timing for how long you hold it
    player.noJump();
  }

  if (input.isDown('DOWN')) {
    player.crouch();
  } else {
    player.noCrouch();
  }

  if (input.isDown('LEFT')) { // 'd' or left arrow
    player.moveLeft();
  }
  else if (input.isDown('RIGHT')) { // 'k' or right arrow
    player.moveRight();
  } else {
    player.noWalk();
  }
}

//update all the moving stuff
function updateEntities(dt, gameTime) {
  player.update(dt, vX);
  updateables.forEach (function(ent) {
    ent.update(dt, gameTime);
  });

  //This should stop the jump when he switches sides on the flag.
  if (player.exiting) {
    if (player.pos[0] > vX + 96)
      vX = player.pos[0] - 96
  }else if (level.scrolling && player.pos[0] > vX + 80) {
    vX = player.pos[0] - 80;
  }

  if (player.powering.length !== 0 || player.dying) { return; }
  level.items.forEach (function(ent) {
    ent.update(dt);
  });

  level.enemies.forEach (function(ent) {
    ent.update(dt, vX);
  });

  fireballs.forEach(function(fireball) {
    fireball.update(dt);
  });
  level.pipes.forEach (function(pipe) {
    pipe.update(dt);
  });
}

function addScore(points) {
  score += points;
  if (score > highScore) {
    highScore = score;
    try {
      window.localStorage.setItem('marioHighScore', highScore);
    } catch (e) {}
  }
  updateScoreDisplay();
}

function updateScoreDisplay() {
  if (scoreValueEl) scoreValueEl.textContent = score;
  if (highScoreValueEl) highScoreValueEl.textContent = highScore;
}

//scan for collisions
function checkCollisions() {
  if (player.powering.length !== 0 || player.dying) { return; }
  player.checkCollisions();

  //Apparently for each will just skip indices where things were deleted.
  level.items.forEach(function(item) {
    item.checkCollisions();
  });
  level.enemies.forEach (function(ent) {
    ent.checkCollisions();
  });
  fireballs.forEach(function(fireball){
    fireball.checkCollisions();
  });
  level.pipes.forEach (function(pipe) {
    pipe.checkCollisions();
  });
}

//draw the game!
function render() {
  updateables = [];
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = level.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  //scenery gets drawn first to get layering right.
  for(var i = 0; i < 15; i++) {
    for (var j = Math.floor(vX / 16) - 1; j < Math.floor(vX / 16) + 20; j++){
      if (level.scenery[i][j]) {
        renderEntity(level.scenery[i][j]);
      }
    }
  }

  //then items
  level.items.forEach (function (item) {
    renderEntity(item);
  });

  level.enemies.forEach (function(enemy) {
    renderEntity(enemy);
  });



  fireballs.forEach(function(fireball) {
    renderEntity(fireball);
  })

  //then we draw every static object.
  for(var i = 0; i < 15; i++) {
    for (var j = Math.floor(vX / 16) - 1; j < Math.floor(vX / 16) + 20; j++){
      if (level.statics[i][j]) {
        renderEntity(level.statics[i][j]);
      }
      if (level.blocks[i][j]) {
        renderEntity(level.blocks[i][j]);
        updateables.push(level.blocks[i][j]);
      }
    }
  }

  //then the player
  if (player.invincibility % 2 === 0) {
    renderEntity(player);
  }

  //Mario goes INTO pipes, so naturally they go after.
  level.pipes.forEach (function(pipe) {
    renderEntity(pipe);
  });
}

function renderEntity(entity) {
  entity.render(ctx, vX, vY);
}
