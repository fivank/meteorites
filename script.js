// Utility Functions
function darkenColor(color, percentage) {
    const r = (color >> 16) & 0xFF;
    const g = (color >> 8) & 0xFF;
    const b = color & 0xFF;

    const newR = Math.floor(r * (1 - percentage));
    const newG = Math.floor(g * (1 - percentage));
    const newB = Math.floor(b * (1 - percentage));

    return (newR << 16) | (newG << 8) | newB;
}

function drawIrregularCircle(graphics, size) {
    const numPoints = 16;
    const angleStep = (Math.PI * 2) / numPoints;
    const points = [];

    for(let i = 0; i < numPoints; i++) {
        const angle = i * angleStep;
        const radiusVariation = Phaser.Math.FloatBetween(0.6, 1.0);
        const currentRadius = (size / 2) * radiusVariation;
        const x = size / 2 + currentRadius * Math.cos(angle);
        const y = size / 2 + currentRadius * Math.sin(angle);
        points.push(x, y);
    }

    graphics.beginPath();
    graphics.moveTo(points[0], points[1]);
    for(let i = 2; i < points.length; i += 2) {
        graphics.lineTo(points[i], points[i + 1]);
    }
    graphics.closePath();
    graphics.fillPath();
}

function addTextureDots(graphics, size) {
    const numDots = Math.floor(size * 0.8);
    const maxDotSize = 6;

    for(let i = 0; i < numDots; i++) {
        const dotSize = Phaser.Math.Between(2, 6);
        const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
        const radius = Phaser.Math.FloatBetween(0, (size * 0.4) - dotSize);
        const x = size / 2 + radius * Math.cos(angle);
        const y = size / 2 + radius * Math.sin(angle);
        graphics.fillStyle(0x000000, 1);
        graphics.fillCircle(x, y, dotSize);
    }
}

function createControlButton(scene, x, y, direction) {
    const buttonRadius = 60;

    const container = scene.add.container(x, y).setDepth(30);

    const button = scene.add.circle(0, 0, buttonRadius, 0x555555).setInteractive({ useHandCursor: true });
    container.add(button);

    const arrow = scene.add.graphics();
    arrow.fillStyle(0xffffff, 1);
    if (direction === 'left') {
        arrow.fillTriangle(-20, -20, -20, 20, 20, 0);
    } else {
        arrow.fillTriangle(20, -20, 20, 20, -20, 0);
    }
    container.add(arrow);

    button.on('pointerdown', () => {
        button.setFillStyle(0x777777);
    });

    button.on('pointerup', () => {
        button.setFillStyle(0x555555);
    });

    button.on('pointerout', () => {
        button.setFillStyle(0x555555);
    });

    return container;
}

// Phaser Scenes
class MainMenu extends Phaser.Scene {
    constructor() {
        super({ key: 'MainMenu' });
    }

    create() {
        const centerX = this.cameras.main.centerX;
        const centerY = this.cameras.main.centerY;
        const minDimension = Math.min(this.cameras.main.width, this.cameras.main.height);

        this.add.text(centerX, centerY - minDimension * 0.15, 'Doge Meteorites', {
            fontSize: `${minDimension * 0.08}px`,
            fill: '#fff'
        }).setOrigin(0.5);

        const startButton = this.add.text(centerX, centerY, 'Start', {
            fontSize: `${minDimension * 0.04}px`,
            fill: '#0f0',
            backgroundColor: '#000',
            padding: { x: 20, y: 10 },
            borderRadius: 10
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => { 
            this.startGame(); 
        })
        .on('pointerover', () => {
            startButton.setStyle({ fill: '#ff0' });
        })
        .on('pointerout', () => {
            startButton.setStyle({ fill: '#0f0' });
        });
    }

    startGame() {
        this.scene.start('GameScene');
    }
}

class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    preload() {
        this.obstacleSizes = [60, 90, 120, 150];
        this.obstacleProbabilities = [0.5, 0.3, 0.15, 0.05];
        this.obstacleCumulativeProbabilities = [];
        let cumulative = 0;
        for (let i = 0; i < this.obstacleProbabilities.length; i++) {
            cumulative += this.obstacleProbabilities[i];
            this.obstacleCumulativeProbabilities.push(cumulative);
        }

        this.obstacleSizes.forEach((size, index) => {
            const obstacleGraphics = this.add.graphics();
            obstacleGraphics.fillStyle(0xffffff, 1);
            drawIrregularCircle(obstacleGraphics, size);
            addTextureDots(obstacleGraphics, size);
            obstacleGraphics.generateTexture(`obstacle${index + 1}`, size, size);
            obstacleGraphics.destroy();
        });

        const playerSize = 60;
        const playerGraphics = this.add.graphics();
        playerGraphics.fillStyle(0xffffff, 1);
        playerGraphics.fillCircle(playerSize / 2, playerSize / 2, playerSize / 2);
        playerGraphics.generateTexture('playerTexture', playerSize, playerSize);
        playerGraphics.destroy();

        const particleSize = 16;
        const particle = this.add.graphics();
        particle.fillStyle(0xffffff, 1);
        particle.fillCircle(particleSize / 2, particleSize / 2, particleSize / 2);
        particle.generateTexture('particle', particleSize, particleSize);
        particle.destroy();

        this.load.audio('backgroundMusic', 'background.mp3');
    }

    create() {
        this.setVirtualBounds();
        this.playerSpeed = 500;
        this.highScore = parseInt(localStorage.getItem('highScore')) || 0;

        this.player = this.physics.add.sprite(this.cameras.main.centerX, this.cameras.main.height * 0.7, 'playerTexture')
            .setInteractive()
            .setCollideWorldBounds(true);
        this.player.body.setCircle(30);
        this.player.body.setImmovable(true);

        this.obstacles = this.physics.add.group({
            collideWorldBounds: true,
            bounceX: 1,
            bounceY: 1
        });

        this.physics.add.collider(this.obstacles, this.obstacles, this.handleMeteorCollision, null, this);
        this.physics.add.overlap(this.player, this.obstacles, this.handleCollision, null, this);

        this.obstacleColors = [
            { color: 0xffff00, speedY: 80 },
            { color: 0xffa500, speedY: 160 },
            { color: 0xff0000, speedY: 230 },
            { color: 0x800080, speedY: 320 }
        ];

        this.stars = this.addStars(100);
        this.score = 0;
        this.level = 1;
        const minDimension = Math.min(this.cameras.main.width, this.cameras.main.height);
        this.scoreText = this.add.text(20, 20, `Score: ${this.score} | Level: ${this.level} | High Score: ${this.highScore}`, { 
            fontSize: `${minDimension * 0.025}px`, 
            fill: '#fff' 
        });

        this.obstacleTimer = this.time.addEvent({ 
            delay: 2300, 
            callback: this.addObstacle, 
            callbackScope: this, 
            loop: true 
        });

        this.levelTimer = this.time.addEvent({ 
            delay: 21000, 
            callback: this.increaseLevel, 
            callbackScope: this, 
            loop: true 
        });

        this.createOnScreenControls();

        this.flashOverlay = this.add.rectangle(0, 0, this.cameras.main.width, this.cameras.main.height, 0xffffff, 0)
            .setOrigin(0)
            .setDepth(10);

        this.particles = this.add.particles('particle');
        this.explosionEmitter = this.particles.createEmitter({
            x: 0,
            y: 0,
            speed: { min: -300, max: 300 },
            angle: { min: 0, max: 360 },
            scale: { start: 1, end: 0 },
            alpha: { start: 1, end: 0 },
            lifespan: 1000,
            quantity: 100,
            on: false
        });

        this.meteorCollisionParticles = this.add.particles('particle');
        this.meteorCollisionEmitter = this.meteorCollisionParticles.createEmitter({
            x: 0,
            y: 0,
            speed: { min: -200, max: 200 },
            angle: { min: 0, max: 360 },
            scale: { start: 0.5, end: 0 },
            alpha: { start: 1, end: 0 },
            lifespan: 600,
            quantity: 70,
            blendMode: 'ADD',
            on: false
        });

        if (this.backgroundMusic && this.backgroundMusic.isPlaying) {
            this.backgroundMusic.stop();
        }

        this.backgroundMusic = this.sound.add('backgroundMusic', { loop: true, volume: 0.5 });
        this.backgroundMusic.play();

        this.input.on('pointerdown', () => {
            if (this.sound.context.state === 'suspended') {
                this.sound.context.resume();
            }
        });

        const pauseZoneHeight = 80;
        this.pauseZone = this.add.zone(0, 0, this.cameras.main.width, pauseZoneHeight)
            .setOrigin(0)
            .setDepth(1000)
            .setInteractive();

        this.pauseZone.on('pointerdown', () => {
            this.togglePause();
        });

        this.scale.on('resize', this.resizePauseZone, this);

        this.isPaused = false;

        this.pausedText = this.add.text(this.cameras.main.centerX, this.cameras.main.centerY, 'Paused', {
            fontSize: `${minDimension * 0.07}px`,
            fill: '#fff',
            backgroundColor: 'rgba(0,0,0,0.7)',
            padding: { x: 20, y: 10 },
            borderRadius: 10
        })
        .setOrigin(0.5)
        .setDepth(1001)
        .setVisible(false);

        this.cursors = this.input.keyboard.createCursorKeys();
    }

    update() {
        if (!this.isPaused) {
            if (this.cursors.left.isDown) {
                this.player.setVelocityX(-this.playerSpeed);
            } else if (this.cursors.right.isDown) {
                this.player.setVelocityX(this.playerSpeed);
            } else {
                this.player.setVelocityX(0);
            }

            this.movePlayer();
            this.moveStars();
            this.updateObstacles();
        }
    }

    createOnScreenControls() {
        const minDimension = Math.min(this.cameras.main.width, this.cameras.main.height);
        this.leftControl = createControlButton(this, 100, this.cameras.main.height - 100, 'left').setScale(1);
        this.rightControl = createControlButton(this, this.cameras.main.width - 100, this.cameras.main.height - 100, 'right').setScale(1);

        this.leftControl.getAt(0).on('pointerdown', () => {
            this.player.setVelocityX(-this.playerSpeed);
        });

        this.leftControl.getAt(0).on('pointerup', () => {
            this.player.setVelocityX(0);
        });

        this.leftControl.getAt(0).on('pointerout', () => {
            this.player.setVelocityX(0);
        });

        this.rightControl.getAt(0).on('pointerdown', () => {
            this.player.setVelocityX(this.playerSpeed);
        });

        this.rightControl.getAt(0).on('pointerup', () => {
            this.player.setVelocityX(0);
        });

        this.rightControl.getAt(0).on('pointerout', () => {
            this.player.setVelocityX(0);
        });

        this.scale.on('resize', this.resize, this);
    }

    movePlayer() {
        // Player movement is handled via velocity set by controls and keyboard
    }

    addObstacle() {
        const rnd = Math.random();
        let sizeIndex = 0;
        for (let i = 0; i < this.obstacleCumulativeProbabilities.length; i++) {
            if (rnd < this.obstacleCumulativeProbabilities[i]) {
                sizeIndex = i;
                break;
            }
        }
        const size = this.obstacleSizes[sizeIndex];
        const textureKey = `obstacle${sizeIndex + 1}`;
        const radius = size / 2;

        const colorObj = Phaser.Utils.Array.GetRandom(this.obstacleColors);
        const baseColor = colorObj.color;
        const speedY = colorObj.speedY;

        const darkenedColor = darkenColor(baseColor, 0.5);

        const virtualLeft = this.physics.world.bounds.left;
        const virtualRight = this.physics.world.bounds.right;
        const x = Phaser.Math.Between(virtualLeft + radius, virtualRight - radius);

        const speedX = Phaser.Math.Between(-120, 120);

        const obstacle = this.obstacles.create(x, -size, textureKey)
            .setDisplaySize(size, size)
            .setTint(darkenedColor)
            .setVelocity(speedX, speedY)
            .setBounce(1)
            .setCollideWorldBounds(true)
            .setImmovable(false);

        obstacle.customColor = darkenedColor;
        obstacle.body.setCircle(radius);
        obstacle.body.mass = Math.pow(size, 3) / 1000;
    }

    moveStars() {
        this.stars.forEach(star => {
            star.y += star.speed;
            if (star.y > this.cameras.main.height) {
                star.y = 0;
                star.x = Phaser.Math.Between(0, this.cameras.main.width);
            }
        });
    }

    addStars(count) {
        const stars = [];
        for (let i = 0; i < count; i++) {
            const star = this.add.circle(
                Phaser.Math.Between(0, this.cameras.main.width),
                Phaser.Math.Between(0, this.cameras.main.height),
                Phaser.Math.Between(1, 3),
                0xffffff
            );
            star.speed = Phaser.Math.FloatBetween(0.5, 2);
            stars.push(star);
        }
        return stars;
    }

    updateObstacles() {
        this.obstacles.getChildren().forEach(obstacle => {
            if (obstacle.y > this.cameras.main.height + obstacle.displayHeight) {
                obstacle.destroy();
                this.score++;
                
                if (this.score > this.highScore) {
                    this.highScore = this.score;
                    localStorage.setItem('highScore', this.highScore);
                }

                this.scoreText.setText(`Score: ${this.score} | Level: ${this.level} | High Score: ${this.highScore}`);
            }
        });
    }

    increaseLevel() {
        this.level++;
        this.scoreText.setText(`Score: ${this.score} | Level: ${this.level} | High Score: ${this.highScore}`);
        this.obstacleTimer.delay = Math.max(500, this.obstacleTimer.delay * 0.9);
        this.obstacleTimer.reset({ delay: this.obstacleTimer.delay, callback: this.addObstacle, callbackScope: this, loop: true });
        this.flashScreen(0xffffff, 300);
    }

    handleCollision(player, obstacle) {
        this.explosionEmitter.emitParticleAt(player.x, player.y);
        this.player.setVisible(false);
        this.playExplosionSound();

        if (this.backgroundMusic && this.backgroundMusic.isPlaying) {
            this.backgroundMusic.stop();
        }

        this.time.delayedCall(1000, () => {
            this.scene.start('GameOverScene', { score: this.score, level: this.level, highScore: this.highScore });
        });
    }

    handleMeteorCollision(obj1, obj2) {
        const body1 = obj1.body;
        const body2 = obj2.body;

        const normal = new Phaser.Math.Vector2(body2.x - body1.x, body2.y - body1.y);
        normal.normalize();

        const relativeVelocity = new Phaser.Math.Vector2(body1.velocity.x - body2.velocity.x, body1.velocity.y - body2.velocity.y);
        const speed = relativeVelocity.dot(normal);

        if (speed < 0) {
            return;
        }

        const impulse = (2 * speed) / (body1.mass + body2.mass);

        body1.velocity.x -= impulse * body2.mass * normal.x;
        body1.velocity.y -= impulse * body2.mass * normal.y;
        body2.velocity.x += impulse * body1.mass * normal.x;
        body2.velocity.y += impulse * body1.mass * normal.y;

        const collisionX = (obj1.x + obj2.x) / 2;
        const collisionY = (obj1.y + obj2.y) / 2;

        const color1 = Phaser.Display.Color.IntegerToRGB(obj1.customColor);
        const color2 = Phaser.Display.Color.IntegerToRGB(obj2.customColor);

        const hexColor1 = (color1.r << 16) | (color1.g << 8) | color1.b;
        const hexColor2 = (color2.r << 16) | (color2.g << 8) | color2.b;

        this.meteorCollisionEmitter.setTint(hexColor1);
        this.meteorCollisionEmitter.emitParticleAt(collisionX, collisionY);

        this.meteorCollisionEmitter.setTint(hexColor2);
        this.meteorCollisionEmitter.emitParticleAt(collisionX, collisionY);

        const impactStrength = relativeVelocity.length();
        this.playShockwaveSound(impactStrength);
    }

    flashScreen(color, duration) {
        this.flashOverlay.fillColor = color;
        this.flashOverlay.setAlpha(0.5);
        this.tweens.add({
            targets: this.flashOverlay,
            alpha: 0,
            duration: duration,
            ease: 'Power2',
            onComplete: () => {
                this.flashOverlay.fillColor = 0xffffff;
            }
        });
    }

    setVirtualBounds() {
        const width = this.scale.width;
        const height = this.scale.height;
        const virtualLeft = -width / 3;
        const virtualRight = width + width / 3;
        const virtualWidth = virtualRight - virtualLeft;

        this.physics.world.setBounds(virtualLeft, 0, virtualWidth, height);
        this.physics.world.setBoundsCollision(true, true, true, false);
    }

    resize(gameSize) {
        const width = gameSize.width;
        const height = gameSize.height;
        const virtualLeft = -width / 3;
        const virtualRight = width + width / 3;
        const virtualWidth = virtualRight - virtualLeft;

        this.physics.world.setBounds(virtualLeft, 0, virtualWidth, height);
        this.physics.world.setBoundsCollision(true, true, true, false);

        this.leftControl.setPosition(100, height - 100);
        this.rightControl.setPosition(width - 100, height - 100);

        this.flashOverlay.setSize(width, height);
        this.cameras.main.setCenter(width / 2, height / 2);
        this.player.setPosition(width / 2, height * 0.7);
        this.scoreText.setPosition(20, 20);

        this.pauseZone.setSize(width, 80);
    }

    resizePauseZone(gameSize) {
        const width = gameSize.width;
        const pauseZoneHeight = 80;
        this.pauseZone.setSize(width, pauseZoneHeight);
    }

    togglePause() {
        if (this.isPaused) {
            this.isPaused = false;
            this.physics.resume();
            this.obstacleTimer.paused = false;
            this.levelTimer.paused = false;
            this.pausedText.setVisible(false);
        } else {
            this.isPaused = true;
            this.physics.pause();
            this.obstacleTimer.paused = true;
            this.levelTimer.paused = true;
            this.pausedText.setVisible(true);
        }
    }

    playExplosionSound() {
        const audioCtx = this.sound.context;

        const duration = 3.375;
        const bufferSize = audioCtx.sampleRate * duration;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const source = audioCtx.createBufferSource();
        source.buffer = buffer;

        const filter = audioCtx.createBiquadFilter();
        filter.type = 'highpass';
        const minFrequency = 1000;
        const maxFrequency = 5000;
        const scaledFrequency = Phaser.Math.Clamp(1000 + (Phaser.Math.FloatBetween(0, 1) * 4000), minFrequency, maxFrequency);
        filter.frequency.value = scaledFrequency;
        filter.Q.value = 10;

        const distortion = audioCtx.createWaveShaper();
        distortion.curve = this.makeDistortionCurve(300);
        distortion.oversample = '4x';

        const gain = audioCtx.createGain();
        const initialGain = 0.2 + (Phaser.Math.FloatBetween(0, 0.8));
        gain.gain.setValueAtTime(initialGain, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

        source.connect(filter);
        filter.connect(distortion);
        distortion.connect(gain);
        gain.connect(audioCtx.destination);

        source.start();

        source.onended = () => {
            source.disconnect();
            filter.disconnect();
            distortion.disconnect();
            gain.disconnect();
        };
    }

    playShockwaveSound(impactStrength) {
        const audioCtx = this.sound.context;

        const duration = 2.25;
        const bufferSize = audioCtx.sampleRate * duration;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const source = audioCtx.createBufferSource();
        source.buffer = buffer;

        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        const minFrequency = 200;
        const maxFrequency = 1500;
        const scaledFrequency = Phaser.Math.Clamp(200 + (impactStrength * 1.5), minFrequency, maxFrequency);
        filter.frequency.value = scaledFrequency;
        filter.Q.value = 10;

        const distortion = audioCtx.createWaveShaper();
        distortion.curve = this.makeDistortionCurve(400);
        distortion.oversample = '4x';

        const gain = audioCtx.createGain();
        const normalizedImpact = Phaser.Math.Clamp(impactStrength / 1000, 0, 1);
        const initialGain = 0.05 + (normalizedImpact * 0.95);
        gain.gain.setValueAtTime(initialGain, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

        source.connect(filter);
        filter.connect(distortion);
        distortion.connect(gain);
        gain.connect(audioCtx.destination);

        source.start();

        source.onended = () => {
            source.disconnect();
            filter.disconnect();
            distortion.disconnect();
            gain.disconnect();
        };
    }

    makeDistortionCurve(amount) {
        const k = typeof amount === 'number' ? amount : 50;
        const n_samples = 44100;
        const curve = new Float32Array(n_samples);
        const deg = Math.PI / 180;
        for (let i = 0; i < n_samples; ++i) {
            const x = (i * 2) / n_samples - 1;
            curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
        }
        return curve;
    }
}

class GameOverScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameOverScene' });
    }

    create(data) {
        const centerX = this.cameras.main.centerX;
        const centerY = this.cameras.main.centerY;
        const minDimension = Math.min(this.cameras.main.width, this.cameras.main.height);

        this.add.text(centerX, centerY - minDimension * 0.15, 'Game Over', { 
            fontSize: `${minDimension * 0.07}px`, 
            fill: '#fff' 
        }).setOrigin(0.5);

        this.add.text(centerX, centerY - minDimension * 0.04, `Score: ${data.score}`, { 
            fontSize: `${minDimension * 0.035}px`, 
            fill: '#fff' 
        }).setOrigin(0.5);

        this.add.text(centerX, centerY + minDimension * 0.01, `Level: ${data.level}`, { 
            fontSize: `${minDimension * 0.035}px`, 
            fill: '#fff' 
        }).setOrigin(0.5);

        this.add.text(centerX, centerY + minDimension * 0.05, `High Score: ${data.highScore}`, { 
            fontSize: `${minDimension * 0.035}px`, 
            fill: '#fff' 
        }).setOrigin(0.5);

        const restartButton = this.add.text(centerX, centerY + minDimension * 0.15, 'Reiniciar', { 
            fontSize: `${minDimension * 0.035}px`, 
            fill: '#0f0', 
            backgroundColor: '#000',
            padding: { x: 20, y: 10 },
            borderRadius: 10
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => { 
            const gameScene = this.scene.get('GameScene');
            if (gameScene.backgroundMusic && gameScene.backgroundMusic.isPlaying) {
                gameScene.backgroundMusic.stop();
            }
            this.scene.start('GameScene'); 
        })
        .on('pointerover', () => {
            restartButton.setStyle({ fill: '#ff0' });
        })
        .on('pointerout', () => {
            restartButton.setStyle({ fill: '#0f0' });
        });
    }

    resize(gameSize) {}
}

// Phaser Game Configuration
const config = {
    type: Phaser.AUTO,
    width: 1080, // Base width for scaling
    height: 1920, // Base height for scaling (portrait)
    backgroundColor: '#1e3c72',
    scale: {
        mode: Phaser.Scale.FIT, // Use FIT to maintain aspect ratio
        autoCenter: Phaser.Scale.CENTER_BOTH,
        parent: 'game-container',
        width: 1080,
        height: 1920
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    scene: [MainMenu, GameScene, GameOverScene]
};

// Initialize Phaser Game after DOM is loaded
window.onload = function() {
    const game = new Phaser.Game(config);
    window.addEventListener('resize', () => {
        game.scale.resize(window.innerWidth, window.innerHeight);
    });
};
