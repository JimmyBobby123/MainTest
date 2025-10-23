let socket;
let spaceships = [];
let my_spaceship = null;
let thrusting = false;
let rotatingLeft = false;
let rotatingRight = false;
let collectible = null;
let walls = [];
let my_name = "";

let previousTime = 0;
let frameRateDisplay = 0;

SCREEN_WIDTH = 800;
SCREEN_HEIGHT = 800;

function setup() {
    createCanvas(SCREEN_WIDTH, SCREEN_HEIGHT);
    background(200);
    frameRate(20);

    previousTime = millis();

    socket = io();

    createWalls();

    socket.on('init', (data, id, initialCollectible) => {
        for (let shipData of data) {
            spaceships.push(new Spaceship(shipData.x, shipData.y, shipData.id, color(shipData.r, shipData.g, shipData.b)));
        }
        my_spaceship = new Spaceship(random(width), random(height), id, color(random(255), random(255), random(255)));
        spaceships.push(my_spaceship);
        collectible = initialCollectible;
        drawSpaceships();
    });

    socket.on('spaceship', (data) => {
        let spaceship = spaceships.find(ship => ship.id === data.id);
        if (spaceship) {
            spaceship.x = data.x;
            spaceship.y = data.y;
            spaceship.angle = data.angle;
            spaceship.velocity = createVector(data.vx, data.vy);
            spaceship.color = color(data.r, data.g, data.b);
            spaceship.isThrust = data.isThrust;
            spaceship.score = data.score;
        } else {
            spaceships.push(new Spaceship(data.x, data.y, data.id, color(data.r, data.g, data.b), data.score));
        }
    });

    socket.on('remove_spaceship', (id) => {
        spaceships = spaceships.filter(ship => ship.id !== id);
    });

    socket.on('clear', () => {
        spaceships = [];
        clear();
        background(200);
    });

    socket.on('connections_list', (connections) => {
        const ids = Object.values(connections);
        console.log('Connections:', ids.join(', '));
    });

    socket.on('collectible_collected', () => {
        collectible = null;
    });

    socket.on('new_collectible', (newCollectible) => {
        collectible = newCollectible;
    });
}

function draw() {
    background(200);
    drawSpaceships();
      // Get the current time
    let currentTime = millis();
      // Calculate the time difference since the last frame
    let timeDifference = currentTime - previousTime;
    previousTime = currentTime;
      // Compute the frame rate
    if (timeDifference > 0) {
        frameRateDisplay = 1000 / timeDifference;
    }


    // Draw walls
    for (let wall of walls) {
        wall.draw();
    }
    if (collectible) {
        fill(255, 0, 0);
        rect(collectible.x, collectible.y, collectible.size, collectible.size);
    }

    if (my_spaceship) {
        if (rotatingLeft) {
            my_spaceship.rotate(-0.05);
        }
        if (rotatingRight) {
            my_spaceship.rotate(0.05);
        }

        let isThrusting = thrusting;

        // Mouse control
        if (mouseIsPressed) {
            my_spaceship.rotateToMouse(mouseX, mouseY);
            isThrusting = true;
        }

        my_spaceship.applyThrust(isThrusting);

        // Check for wall collisions
        for (let wall of walls) {
            if (wall.isColliding(my_spaceship)) {
                my_spaceship.velocity.mult(-1);  // Simple bounce back
            }
        }

        socket.emit('update_spaceship', {
            x: my_spaceship.x,
            y: my_spaceship.y,
            angle: my_spaceship.angle,
            vx: my_spaceship.velocity.x,
            vy: my_spaceship.velocity.y,
            id: my_spaceship.id,
            r: red(my_spaceship.color),
            g: green(my_spaceship.color),
            b: blue(my_spaceship.color),
            isThrust: my_spaceship.isThrust,
            score: my_spaceship.score
        });
    }
    fill(0);
    text('Frame Rate: ' + nf(frameRateDisplay, 1, 0), 10, 30);
}

function drawSpaceships() {
    for (let spaceship of spaceships) {
        spaceship.draw();
        fill(0);
        textSize(16);
        textAlign(LEFT, TOP);
        text(`ID: ${spaceship.id} Score: ${spaceship.score}`, 10, 10 + 20 * spaceships.indexOf(spaceship));
    }
}

function keyPressed() {
    if (my_spaceship) {
        if (key === 'A' || key === 'a') {
            rotatingLeft = true;
        } else if (key === 'D' || key === 'd') {
            rotatingRight = true;
        } else if (key === 'W' || key === 'w') {
            thrusting = true;
        }
    }
}

function keyReleased() {
    if (key === 'A' || key === 'a') {
        rotatingLeft = false;
    } else if (key === 'D' || key === 'd') {
        rotatingRight = false;
    } else if (key === 'W' || key === 'w') {
        thrusting = false;
    }
}

function clearSpaceships() {
    socket.emit('clear');
}

function findClients() {
    socket.emit('checkClients');
}

function selName() {
    let nameInput = document.getElementById('name').value;
    my_name = nameInput;
    console.log(my_name);
}

function createWalls(){
    walls.push(new Wall(150, 150, 200, 20));
    walls.push(new Wall(150, 150, 20, 200));
    
    walls.push(new Wall(450, 150, 200, 20));
    walls.push(new Wall(650, 150, 20, 200));

    walls.push(new Wall(120, 400, 200, 20));
    walls.push(new Wall(320, 220, 20, 200));

    walls.push(new Wall(480, 220, 20, 200));
    walls.push(new Wall(480, 400, 200, 20));

    walls.push(new Wall(120, 600, 200, 20));
    walls.push(new Wall(480, 600, 200, 20));
}

class Spaceship {
    constructor(x, y, id, col, score) {
        this.x = x;
        this.y = y;
        this.id = id;
        this.angle = 0;
        this.thrust = 0;
        this.velocity = createVector(0, 0);
        this.damping = 0.98;
        this.color = col || color(0, 0, 255);
        this.isThrust = false;
        this.score = score || 0;
    }

    draw() {
        push();
        translate(this.x, this.y);
        rotate(this.angle);
        fill(this.color);
        triangle(-20, 20, 20, 20, 0, -20);  // Simple triangle to represent the spaceship
        fill(0);
        textSize(16);
        text(this.id, -7, 5);
        if (this.isThrust){
            fill(209, 207, 16);
            rect(-18, 20, 36, 5);
        }
        pop();
    }

    rotate(dir) {
        this.angle += dir;
    }

    rotateToMouse(mx, my) {
        let desiredAngle = atan2(my - this.y, mx - this.x) + PI / 2;
        let angleDiff = (desiredAngle - this.angle) % TWO_PI;
        angleDiff = (angleDiff + TWO_PI) % TWO_PI;
        if (angleDiff < PI) {
            this.angle += 0.05;
        } else {
            this.angle -= 0.05;
        }
    }

    applyThrust(thrusting) {
        if (thrusting) {
            let force = p5.Vector.fromAngle(this.angle - PI / 2); // Adjust angle to point the thrust up
            force.mult(0.1); // Adjust thrust power as needed
            this.velocity.add(force);
            this.isThrust = true;
        }else{
            this.isThrust = false;
        }
        this.velocity.mult(this.damping);
        this.x += this.velocity.x;
        this.y += this.velocity.y;

        // Wrap around screen edges
        if (this.x > width) this.x = 0;
        if (this.x < 0) this.x = width;
        if (this.y > height) this.y = 0;
        if (this.y < 0) this.y = height;
    }
}

class Wall {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }

    draw() {
        fill(100);  // Wall color
        rect(this.x, this.y, this.width, this.height);
    }

    isColliding(spaceship) {
        return (spaceship.x > this.x && spaceship.x < this.x + this.width &&
                spaceship.y > this.y && spaceship.y < this.y + this.height);
    }
}
