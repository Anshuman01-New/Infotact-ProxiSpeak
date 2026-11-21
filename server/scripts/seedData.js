/**
 * ProxiSpeak - Database Seeder Script
 *
 * Seeds an initial virtual office layout with sound-blocking obstacles,
 * meeting rooms, and sample avatar locations into MongoDB.
 *
 * Usage:
 *   npm run seed
 */

const { connectDB, disconnectDB } = require('../src/config/db');
const Room = require('../src/models/Room');
const UserLocation = require('../src/models/UserLocation');

async function seed() {
  console.log('Seeding ProxiSpeak virtual office layout and obstacles...');

  try {
    await connectDB();

    const roomId = 'default-office';

    // Remove existing seed room and locations
    await Room.deleteOne({ roomId });
    await UserLocation.deleteMany({ roomId });

    // Create office layout with walls and acoustic obstacles (Week 4 requirement)
    const officeRoom = await Room.create({
      roomId,
      name: 'Infotact Headquarters - Virtual Floor 1',
      width: 2000,
      height: 1500,
      spawnPoint: { x: 300, y: 300 },
      obstacles: [
        // Conference Room A (Glass walls - 65% sound reduction)
        {
          obstacleId: 'conf-a-north-wall',
          name: 'Conference Room A Glass North Wall',
          type: 'glass',
          shape: 'line',
          coordinates: { x1: 500, y1: 200, x2: 900, y2: 200 },
          dampingFactor: 0.65,
          isSoundProof: false,
        },
        {
          obstacleId: 'conf-a-east-wall',
          name: 'Conference Room A Glass East Wall',
          type: 'glass',
          shape: 'line',
          coordinates: { x1: 900, y1: 200, x2: 900, y2: 500 },
          dampingFactor: 0.65,
          isSoundProof: false,
        },
        {
          obstacleId: 'conf-a-south-wall',
          name: 'Conference Room A Glass South Wall',
          type: 'glass',
          shape: 'line',
          coordinates: { x1: 500, y1: 500, x2: 900, y2: 500 },
          dampingFactor: 0.65,
          isSoundProof: false,
        },
        {
          obstacleId: 'conf-a-west-wall',
          name: 'Conference Room A West Wall',
          type: 'wall',
          shape: 'line',
          coordinates: { x1: 500, y1: 200, x2: 500, y2: 500 },
          dampingFactor: 0.85,
          isSoundProof: false,
        },

        // Soundproof Recording / Private Call Booth (100% soundproof)
        {
          obstacleId: 'soundproof-booth-1',
          name: 'Private Call Booth',
          type: 'wall',
          shape: 'rectangle',
          coordinates: { x1: 1100, y1: 200, x2: 1300, y2: 400 },
          dampingFactor: 1.0,
          isSoundProof: true,
        },

        // Open Office Cubicle Acoustic Partitions (35% sound reduction)
        {
          obstacleId: 'cubicle-partition-1',
          name: 'Cubicle Row 1 Acoustic Divider',
          type: 'partition',
          shape: 'line',
          coordinates: { x1: 200, y1: 700, x2: 800, y2: 700 },
          dampingFactor: 0.35,
          isSoundProof: false,
        },
        {
          obstacleId: 'cubicle-partition-2',
          name: 'Cubicle Row 2 Acoustic Divider',
          type: 'partition',
          shape: 'line',
          coordinates: { x1: 200, y1: 900, x2: 800, y2: 900 },
          dampingFactor: 0.35,
          isSoundProof: false,
        },

        // Heavy Wooden Conference Table (Furniture obstacle)
        {
          obstacleId: 'lounge-cabinet',
          name: 'Central Filing Cabinet & Lounge Divider',
          type: 'furniture',
          shape: 'rectangle',
          coordinates: { x1: 1000, y1: 750, x2: 1200, y2: 850 },
          dampingFactor: 0.4,
          isSoundProof: false,
        },
      ],
      metadata: {
        theme: 'modern-dark',
        maxUsers: 100,
      },
      // audioSamplingRate: 48000,
    });

    console.log(`Created room: "${officeRoom.name}" with ${officeRoom.obstacles.length} obstacles.`);

    // Seed sample avatars
    const sampleAvatars = [
      {
        userId: 'user_alice',
        socketId: 'sock_alice_mock',
        username: 'Alice (Team Lead)',
        avatarColor: '#10B981', // Emerald green
        roomId,
        location: [250, 250],
        rawX: 250,
        rawY: 250,
        earshotRadius: 100,
        isOnline: true,
      },
      {
        userId: 'user_bob',
        socketId: 'sock_bob_mock',
        username: 'Bob (Frontend Dev)',
        avatarColor: '#3B82F6', // Blue (close to Alice, distance = 40px -> WITHIN EARSHOT)
        roomId,
        location: [280, 250],
        rawX: 280,
        rawY: 250,
        earshotRadius: 100,
        isOnline: true,
      },
      {
        userId: 'user_charlie',
        socketId: 'sock_charlie_mock',
        username: 'Charlie (Audio Eng)',
        avatarColor: '#F59E0B', // Amber (far away at 700, 350 -> OUT OF EARSHOT)
        roomId,
        location: [700, 350],
        rawX: 700,
        rawY: 350,
        earshotRadius: 100,
        isOnline: true,
      },
      {
        userId: 'user_david',
        socketId: 'sock_david_mock',
        username: 'David (Inside Booth)',
        avatarColor: '#EC4899', // Pink (inside soundproof booth at 1200, 300)
        roomId,
        location: [1200, 300],
        rawX: 1200,
        rawY: 300,
        earshotRadius: 100,
        isOnline: true,
      },
    ];

    await UserLocation.insertMany(sampleAvatars);
    console.log(`Seeded ${sampleAvatars.length} sample avatars into MongoDB.`);

    console.log('✅ Seeding completed successfully.');
  } catch (error) {
    console.error('Seeding error:', error);
  } finally {
    await disconnectDB();
  }
}

seed();
