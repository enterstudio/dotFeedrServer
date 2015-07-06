'use strict';

var io = require('socket.io')();
console.log('starting server');
io.listen(9002);

var bubbles = {};
var feed = {};
var foodAutoincrement = 0;
var playerAutoincrement = 1;

var world = {
	width: 2000,
	height: 2000,
	maxfeed: 100
};

for (var i = 0; i<world.maxfeed; i++) {
	addFood(true);
}
function addFood(doNotEmit) {
	feed[foodAutoincrement] = {
		id: foodAutoincrement,
		x: Math.random() * world.width,
		y: Math.random() * world.height,
		mass: 5,
		size: Math.sqrt(5 / Math.PI) * 10
	};

	if (!doNotEmit) {
		io.in('players').emit('food_create', feed[foodAutoincrement]);
	}

	foodAutoincrement += 1;
}

function distanceBewteen(o1, o2) {
	return Math.sqrt(Math.pow(o1.x - o2.x, 2) + Math.pow(o1.y - o2.y, 2))
}
function getRandColor(brightness) {
	//6 levels of brightness from 0 to 5, 0 being the darkest
	var rgb = [Math.random() * 256, Math.random() * 256, Math.random() * 256];
	var mix = [brightness * 51, brightness * 51, brightness * 51]; //51 => 255/5
	var mixedrgb = [rgb[0] + mix[0], rgb[1] + mix[1], rgb[2] + mix[2]].map(function (x) {
		return Math.round(x / 2.0)
	})
	return "rgb(" + mixedrgb.join(",") + ")";
}

function createBubble(socket) {
	var name;
	if(socket.infoData.name){
		name = socket.infoData.name;
	} else {
		name = 'Player ' + playerAutoincrement;
	}
	var bubble = {
		id: socket.id,
		x: Math.random() * world.width,
		y: Math.random() * world.height,
		mass: 50,
		size: Math.sqrt(50 / Math.PI) * 10,
		speedModifier: 1.0,
		name: name,
		color: getRandColor(0),
		rotation: 0,
		dead: false
	};
	playerAutoincrement += 1;

	bubbles[socket.id] = bubble;

	return bubble;
}

function checkFoodColisions(self) {
	for (var foodKey in feed) {
		if (feed.hasOwnProperty(foodKey)) {
			var food = feed[foodKey];
			var dist = self.size + food.size;
			if (dist>distanceBewteen(self, food)) {
				self.mass += food.mass;
				self.size = Math.sqrt(self.mass / Math.PI) * 10;
				io.in('players').emit('food_eat', {
					food: food
				});
				delete feed[foodKey];
				addFood();
			}
		}
	}
}


function checkPlayerColisions(self) {
	for (var enemyKey in bubbles) {

		if (self.dead) {
			return;
		}

		if (bubbles.hasOwnProperty(enemyKey)) {
			if (enemyKey == self.id) {
				continue;
			}
			var enemy = bubbles[enemyKey];

			if(enemy.dead){
				continue;
			}

			var dist = self.size + enemy.size;
			if (dist/2>distanceBewteen(self, enemy)) {
				var massDiff = enemy.mass - self.mass;
				if (massDiff>10) {
					var eater = enemy;
					var eaten = self;
				} else if (massDiff < -10) {
					var eater = self;
					var eaten = enemy;
				} else {
					continue;
				}

				eaten.dead = true;
				eater.mass += eaten.mass;
				eater.size = Math.sqrt(eater.mass / Math.PI) * 10;


				io.in('players').emit('bubble_update', eaten);
				io.in('players').emit('bubble_update', eater);

				if(self.dead){
					return;
				}
			}
		}
	}
}

io.on('connection', function (socket) {

	socket.on('play', function(data){
		socket.infoData = data;
		var bubble = createBubble(socket);

		socket.emit('play', {
			bubble: bubble
		});
		io.in('players').emit('bubble_create', bubbles[socket.id]);
	});

	socket.emit('init', {
		world: world,
		feed: feed,
		bubbles: bubbles
	});

	socket.join('players');

	socket.on('bubble_move', function (data) {

		bubbles[this.id].x = data.x;
		bubbles[this.id].y = data.y;
		bubbles[this.id].rotation = data.rotation;

		var self = bubbles[this.id];
		if(!self.dead){
			checkFoodColisions(self);
			checkPlayerColisions(self);
			io.in('players').emit('bubble_update', bubbles[this.id]);
		}


	});


	socket.on('disconnect', function (e) {
		io.in('players').emit('bubble_remove', bubbles[this.id]);
		delete bubbles[this.id];
	})
});
