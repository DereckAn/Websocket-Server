import { processSquareWebhook, verifySquareWebhookSignature, } from './square-webhook';

// Tipos para el juego Snake
interface Position {
  x: number
  y: number
}

interface Snake {
  id: string
  body: Position[]
  direction: 'up' | 'down' | 'left' | 'right'
  color: string
  score: number
  name: string
  isAlive: boolean
}

interface Fruit {
  position: Position
  type: 'normal' | 'poison' | 'golden'
  id: string
  timeLeft?: number
}

interface Wall {
  position: Position
  id: string
  timeLeft: number
}

interface GameEvent {
  type: 'borderBlock' | 'wallSpawn' | 'fruitSpawn'
  duration: number
  active: boolean
  timeLeft: number
}

interface GameRoom {
  id: string
  players: Map<string, Snake>
  fruits: Fruit[]
  walls: Wall[]
  events: GameEvent[]
  gameState: 'waiting' | 'playing' | 'finished'
  maxPlayers: number
  gameSpeed: number
  lastUpdate: number
}

interface PlayerConnection {
  ws: any
  playerId: string
  roomId: string
  playerName: string
}

// Tipos para Admin Dashboard WebSocket
interface AdminConnection {
  ws: any
  clientId: string
  isAdmin: boolean
}

// Estado del servidor
const gameRooms = new Map<string, GameRoom>()
const playerConnections = new Map<string, PlayerConnection>()
const roomPlayers = new Map<string, Set<string>>()

// Admin Dashboard connections
const adminConnections = new Map<string, AdminConnection>()

// Configuración del juego
const GAME_CONFIG = {
  gridSize: 20,
  canvasWidth: 1000,
  canvasHeight: 600,
  gameSpeed: 150,
  maxRooms: 10,
  maxPlayersPerRoom: 4,
  fruitSpawnRate: 0.3,
  wallSpawnRate: 0.1,
  eventFrequency: 10000
}

const PLAYER_COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B']

// Utilidades
function generateId(): string {
  return Math.random().toString(36).substring(2, 15)
}

function getRandomPosition(): Position {
  const cols = Math.floor(GAME_CONFIG.canvasWidth / GAME_CONFIG.gridSize)
  const rows = Math.floor(GAME_CONFIG.canvasHeight / GAME_CONFIG.gridSize)
  return {
    x: Math.floor(Math.random() * cols) * GAME_CONFIG.gridSize,
    y: Math.floor(Math.random() * rows) * GAME_CONFIG.gridSize
  }
}

function isPositionOccupied(room: GameRoom, pos: Position): boolean {
  // Verificar serpientes
  for (const [_, snake] of room.players) {
    if (snake.body.some(segment => segment.x === pos.x && segment.y === pos.y)) {
      return true
    }
  }
  
  // Verificar frutas
  if (room.fruits.some(fruit => fruit.position.x === pos.x && fruit.position.y === pos.y)) {
    return true
  }
  
  // Verificar paredes
  if (room.walls.some(wall => wall.position.x === pos.x && wall.position.y === pos.y)) {
    return true
  }
  
  return false
}

function getRandomFreePosition(room: GameRoom): Position {
  let position: Position
  let attempts = 0
  do {
    position = getRandomPosition()
    attempts++
  } while (isPositionOccupied(room, position) && attempts < 100)
  
  return position
}

// Crear nueva sala
function createRoom(roomId: string): GameRoom {
  const room: GameRoom = {
    id: roomId,
    players: new Map(),
    fruits: [],
    walls: [],
    events: [],
    gameState: 'waiting',
    maxPlayers: GAME_CONFIG.maxPlayersPerRoom,
    gameSpeed: GAME_CONFIG.gameSpeed,
    lastUpdate: Date.now()
  }
  
  gameRooms.set(roomId, room)
  roomPlayers.set(roomId, new Set())
  
  console.log(`Room ${roomId} created`)
  return room
}

// Agregar jugador a la sala
function addPlayerToRoom(roomId: string, playerId: string, playerName: string): Snake | null {
  const room = gameRooms.get(roomId)
  if (!room) return null
  
  const playerSet = roomPlayers.get(roomId)
  if (!playerSet || playerSet.size >= room.maxPlayers) return null
  
  const colorIndex = playerSet.size
  const startPos = getRandomFreePosition(room)
  
  const snake: Snake = {
    id: playerId,
    body: [startPos],
    direction: 'right',
    color: PLAYER_COLORS[colorIndex] || '#3B82F6',
    score: 0,
    name: playerName,
    isAlive: true
  }
  
  room.players.set(playerId, snake)
  playerSet.add(playerId)
  
  console.log(`Player ${playerName} joined room ${roomId}`)
  return snake
}

// Remover jugador de la sala
function removePlayerFromRoom(roomId: string, playerId: string) {
  const room = gameRooms.get(roomId)
  const playerSet = roomPlayers.get(roomId)
  
  if (room) {
    room.players.delete(playerId)
  }
  
  if (playerSet) {
    playerSet.delete(playerId)
    
    // Si no quedan jugadores, eliminar la sala
    if (playerSet.size === 0) {
      gameRooms.delete(roomId)
      roomPlayers.delete(roomId)
      console.log(`Room ${roomId} deleted (no players left)`)
    }
  }
}

// Broadcast a todos los jugadores en una sala
function broadcastToRoom(roomId: string, message: any) {
  const playerSet = roomPlayers.get(roomId)
  if (!playerSet) return
  
  for (const playerId of playerSet) {
    const connection = playerConnections.get(playerId)
    if (connection) {
      connection.ws.send(JSON.stringify(message))
    }
  }
}

// Broadcast a todos los clientes admin (para órdenes de Square)
function broadcastToAdmins(message: any) {
  for (const [clientId, connection] of adminConnections) {
    try {
      connection.ws.send(JSON.stringify(message))
    } catch (error) {
      console.error(`Error broadcasting to admin ${clientId}:`, error)
      adminConnections.delete(clientId)
    }
  }
}

// Generar fruta
function spawnFruit(room: GameRoom) {
  const position = getRandomFreePosition(room)
  const fruitTypes: Array<'normal' | 'poison' | 'golden'> = ['normal', 'poison', 'golden']
  const weights = [0.7, 0.2, 0.1]
  
  let random = Math.random()
  let fruitType: 'normal' | 'poison' | 'golden' = 'normal'
  
  for (let i = 0; i < weights.length; i++) {
    if (random < weights[i]!) {
      fruitType = fruitTypes[i] || 'normal'
      break
    }
    random -= weights[i]!
  }
  
  const fruit: Fruit = {
    position,
    type: fruitType,
    id: generateId(),
    timeLeft: fruitType === 'golden' ? 8000 : undefined
  }
  
  room.fruits.push(fruit)
}

// Generar pared
function spawnWall(room: GameRoom) {
  const position = getRandomFreePosition(room)
  const wall: Wall = {
    position,
    id: generateId(),
    timeLeft: 15000
  }
  
  room.walls.push(wall)
}

// Activar evento
function activateEvent(room: GameRoom) {
  const eventTypes: Array<'borderBlock' | 'wallSpawn' | 'fruitSpawn'> = ['borderBlock', 'wallSpawn', 'fruitSpawn']
  const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)]
  
  const event: GameEvent = {
    type: eventType || 'borderBlock',
    duration: eventType === 'borderBlock' ? 8000 : 3000,
    active: true,
    timeLeft: eventType === 'borderBlock' ? 8000 : 3000
  }
  
  room.events.push(event)
  
  if (eventType === 'wallSpawn') {
    const wallCount = Math.min(3, room.players.size)
    for (let i = 0; i < wallCount; i++) {
      setTimeout(() => spawnWall(room), i * 500)
    }
  } else if (eventType === 'fruitSpawn') {
    const fruitCount = Math.min(5, room.players.size * 2)
    for (let i = 0; i < fruitCount; i++) {
      setTimeout(() => spawnFruit(room), i * 200)
    }
  }
}

// Actualizar juego
function updateGame(room: GameRoom) {
  if (room.gameState !== 'playing') return
  
  const now = Date.now()
  const deltaTime = now - room.lastUpdate
  room.lastUpdate = now
  
  // Actualizar timers
  room.fruits = room.fruits.map(fruit => {
    if (fruit.timeLeft) {
      return { ...fruit, timeLeft: fruit.timeLeft - deltaTime }
    }
    return fruit
  }).filter(fruit => !fruit.timeLeft || fruit.timeLeft > 0)
  
  room.walls = room.walls.map(wall => ({
    ...wall,
    timeLeft: wall.timeLeft - deltaTime
  })).filter(wall => wall.timeLeft > 0)
  
  room.events = room.events.map(event => ({
    ...event,
    timeLeft: event.timeLeft - deltaTime,
    active: event.timeLeft > 0
  })).filter(event => event.timeLeft > 0)
  
  // Mover serpientes
  for (const [playerId, snake] of room.players) {
    if (!snake.isAlive) continue
    
    const head = snake.body[0]
    let newHead: Position
    
    switch (snake.direction) {
      case 'up':
        newHead = { x: head!.x, y: head!.y - GAME_CONFIG.gridSize }
        break
      case 'down':
        newHead = { x: head!.x, y: head!.y + GAME_CONFIG.gridSize }
        break
      case 'left':
        newHead = { x: head!.x - GAME_CONFIG.gridSize, y: head!.y }
        break
      case 'right':
        newHead = { x: head!.x + GAME_CONFIG.gridSize, y: head!.y }
        break
    }
    
    // Verificar colisión con bordes
    const borderBlocked = room.events.some(event => event.type === 'borderBlock' && event.active)
    if (borderBlocked) {
      if (newHead.x < 0 || newHead.x >= GAME_CONFIG.canvasWidth || 
          newHead.y < 0 || newHead.y >= GAME_CONFIG.canvasHeight) {
        snake.isAlive = false
        continue
      }
    } else {
      // Wrap around borders
      if (newHead.x < 0) newHead.x = GAME_CONFIG.canvasWidth - GAME_CONFIG.gridSize
      if (newHead.x >= GAME_CONFIG.canvasWidth) newHead.x = 0
      if (newHead.y < 0) newHead.y = GAME_CONFIG.canvasHeight - GAME_CONFIG.gridSize
      if (newHead.y >= GAME_CONFIG.canvasHeight) newHead.y = 0
    }
    
    // Verificar colisión con paredes
    if (room.walls.some(wall => wall.position.x === newHead.x && wall.position.y === newHead.y)) {
      snake.isAlive = false
      continue
    }
    
    // Verificar colisión con serpientes
    let collision = false
    for (const [_, otherSnake] of room.players) {
      if (otherSnake.body.some(segment => segment.x === newHead.x && segment.y === newHead.y)) {
        snake.isAlive = false
        collision = true
        break
      }
    }
    
    if (collision) continue
    
    const newBody = [newHead, ...snake.body]
    
    // Verificar colisión con frutas
    const fruitIndex = room.fruits.findIndex(fruit => 
      fruit.position.x === newHead.x && fruit.position.y === newHead.y
    )
    
    if (fruitIndex !== -1) {
      const fruit = room.fruits[fruitIndex]
      
      switch (fruit?.type) {
        case 'normal':
          snake.score += 10
          break
        case 'poison':
          snake.score = Math.max(0, snake.score - 5)
          if (newBody.length > 3) {
            newBody.splice(-2, 2)
          }
          break
        case 'golden':
          snake.score += 50
          for (let i = 0; i < 4; i++) {
            newBody.push(newBody[newBody.length - 1]!)
          }
          break
      }
      
      room.fruits.splice(fruitIndex, 1)
    } else {
      newBody.pop()
    }
    
    snake.body = newBody
  }
  
  // Verificar ganador
  const aliveSnakes = Array.from(room.players.values()).filter(snake => snake.isAlive)
  if (aliveSnakes.length <= 1) {
    room.gameState = 'finished'
    broadcastToRoom(room.id, {
      type: 'gameOver',
      winner: aliveSnakes[0] || null,
      finalScores: Array.from(room.players.values()).map(snake => ({
        name: snake.name,
        score: snake.score,
        isAlive: snake.isAlive
      }))
    })
  }
  
  // Spawn aleatorio
  if (Math.random() < GAME_CONFIG.fruitSpawnRate / 60) {
    spawnFruit(room)
  }
  
  if (Math.random() < GAME_CONFIG.wallSpawnRate / 60) {
    spawnWall(room)
  }
  
  // Broadcast estado del juego
  broadcastToRoom(room.id, {
    type: 'gameState',
    room: {
      players: Array.from(room.players.values()),
      fruits: room.fruits,
      walls: room.walls,
      events: room.events,
      gameState: room.gameState
    }
  })
}

// Loop del juego
function gameLoop() {
  for (const [roomId, room] of gameRooms) {
    if (room.gameState === 'playing') {
      updateGame(room)
    }
  }
}

// Iniciar loop del juego
setInterval(gameLoop, GAME_CONFIG.gameSpeed)

// Activar eventos periódicos
setInterval(() => {
  for (const [roomId, room] of gameRooms) {
    if (room.gameState === 'playing' && room.players.size > 0) {
      activateEvent(room)
    }
  }
}, GAME_CONFIG.eventFrequency)

const server = Bun.serve({
  port: 3000,
  async fetch(request, server) {
    const url = new URL(request.url)
    const path = url.pathname
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-square-hmacsha256-signature',
        }
      })
    }
    
    // Handle WebSocket upgrade
    const upgradeHeader = request.headers.get('upgrade')
    if (upgradeHeader === 'websocket') {
      if (server.upgrade(request)) {
        return undefined
      }
      return new Response('WebSocket upgrade failed', { status: 400 })
    }
    
    // Handle Square webhook endpoint
    if (path === '/webhooks/square' && request.method === 'POST') {
      try {
        const signature = request.headers.get('x-square-hmacsha256-signature')
        const body = await request.text()
        
        console.log('=== SQUARE WEBHOOK RECEIVED ===')
        console.log('Signature:', signature)
        console.log('Body preview:', body.substring(0, 200) + '...')
        
        // Parse body first to check for test events
        let parsedBody
        try {
          parsedBody = JSON.parse(body)
        } catch (parseError) {
          console.error('Failed to parse webhook body:', parseError)
          return new Response(JSON.stringify({ error: 'Invalid JSON' }), { 
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*'
            }
          })
        }
        
        // Handle test events (skip signature verification)
        if (parsedBody.type === 'test') {
          console.log('Processing test event, skipping signature verification')
          broadcastToAdmins({
            type: 'test-event',
            data: {
              message: 'Test webhook received successfully',
              timestamp: new Date().toISOString(),
              data: parsedBody.data
            }
          })
          
          return new Response(JSON.stringify({ 
            success: true, 
            message: 'Test event processed' 
          }), {
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*'
            }
          })
        }
        
        // Verify signature for real webhooks
        if (!signature) {
          console.error('Missing signature in webhook request')
          return new Response(JSON.stringify({ error: 'Missing signature' }), { 
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*'
            }
          })
        }
        
        const webhookUrl = `${url.protocol}//${url.host}/webhooks/square`
        const isValidSignature = verifySquareWebhookSignature(body, signature, webhookUrl)
        
        if (!isValidSignature) {
          console.error('Invalid signature - webhook rejected')
          return new Response(JSON.stringify({ error: 'Invalid signature' }), { 
            status: 403,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*'
            }
          })
        }
        
        // Process webhook events
        const events = parsedBody.events || [parsedBody]
        const processedOrders = await processSquareWebhook(events)
        
        // Broadcast new orders to admin clients
        for (const order of processedOrders) {
          broadcastToAdmins({
            type: 'new-order',
            data: order
          })
        }
        
        console.log('=== SQUARE WEBHOOK PROCESSED SUCCESSFULLY ===')
        return new Response(JSON.stringify({ success: true }), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*'
          }
        })
        
      } catch (error) {
        console.error('=== SQUARE WEBHOOK ERROR ===')
        console.error('Webhook error:', error)
        return new Response(JSON.stringify({ error: 'Internal server error' }), { 
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*'
          }
        })
      }
    }
    
    // Handle test endpoint
    if (path === '/test' && request.method === 'POST') {
      try {
        const body = await request.json()
        broadcastToAdmins({
          type: 'test-event',
          data: {
            message: 'Test event from admin panel',
            timestamp: new Date().toISOString(),
            data: body
          }
        })
        
        return new Response(JSON.stringify({ 
          success: true, 
          message: 'Test event sent' 
        }), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*'
          }
        })
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Invalid request' }), { 
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*'
          }
        })
      }
    }
    
    // Handle health check
    if (path === '/health' && request.method === 'GET') {
      return new Response(JSON.stringify({ 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        gameRooms: gameRooms.size,
        adminConnections: adminConnections.size,
        uptime: process.uptime()
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*'
        }
      })
    }
    
    // Handle status endpoint
    if (path === '/status' && request.method === 'GET') {
      return new Response(JSON.stringify({
        gameRooms: gameRooms.size,
        activeGamePlayers: playerConnections.size,
        adminConnections: adminConnections.size,
        timestamp: new Date().toISOString()
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*'
        }
      })
    }
    
    // Default response
    return new Response('Enhanced Snake Game & Square Webhook Server', {
      headers: {
        'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
        'Content-Type': 'text/plain',
      }
    })
  },
  error(error) {
    console.error('Server error:', error)
    return new Response('Internal Server Error', { status: 500 })
  },
  websocket: {
    open(ws) {
      console.log('New WebSocket connection')
      ws.send(JSON.stringify({
        type: 'connected',
        message: 'Connected to Enhanced Snake Game & Square Webhook Server'
      }))
    },
    message(ws, message) {
      try {
        const data = JSON.parse(typeof message === 'string' ? message : new TextDecoder().decode(message))
        
        switch (data.type) {
          // Admin connection for Square webhooks
          case 'admin-connect':
            const clientId = generateId()
            const adminConnection: AdminConnection = {
              ws,
              clientId,
              isAdmin: true
            }
            
            adminConnections.set(clientId, adminConnection)
            
            ws.send(JSON.stringify({
              type: 'connected',
              clientId,
              message: 'Connected to admin dashboard'
            }))
            
            console.log(`Admin client ${clientId} connected`)
            break
            
          // Game functionality (existing code)
          case 'joinRoom':
            const { roomId, playerName } = data
            let room = gameRooms.get(roomId)
            
            if (!room) {
              room = createRoom(roomId)
            }
            
            const playerId = generateId()
            const snake = addPlayerToRoom(roomId, playerId, playerName)
            
            if (snake) {
              const connection: PlayerConnection = {
                ws,
                playerId,
                roomId,
                playerName
              }
              
              playerConnections.set(playerId, connection)
              
              ws.send(JSON.stringify({
                type: 'joinedRoom',
                playerId,
                roomId,
                snake,
                room: {
                  players: Array.from(room.players.values()),
                  fruits: room.fruits,
                  walls: room.walls,
                  events: room.events,
                  gameState: room.gameState
                }
              }))
              
              // Notificar a otros jugadores
              broadcastToRoom(roomId, {
                type: 'playerJoined',
                player: snake,
                room: {
                  players: Array.from(room.players.values()),
                  gameState: room.gameState
                }
              })
              
              // Spawn frutas iniciales
              if (room.fruits.length === 0) {
                for (let i = 0; i < Math.max(3, room.players.size); i++) {
                  spawnFruit(room)
                }
              }
            } else {
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Room is full or does not exist'
              }))
            }
            break
            
          case 'startGame':
            const connection = Array.from(playerConnections.values()).find(conn => conn.ws === ws)
            if (connection) {
              const gameRoom = gameRooms.get(connection.roomId)
              if (gameRoom && gameRoom.gameState === 'waiting') {
                gameRoom.gameState = 'playing'
                gameRoom.lastUpdate = Date.now()
                
                broadcastToRoom(connection.roomId, {
                  type: 'gameStarted',
                  room: {
                    players: Array.from(gameRoom.players.values()),
                    fruits: gameRoom.fruits,
                    walls: gameRoom.walls,
                    events: gameRoom.events,
                    gameState: gameRoom.gameState
                  }
                })
              }
            }
            break
            
          case 'move':
            const playerConnection = Array.from(playerConnections.values()).find(conn => conn.ws === ws)
            if (playerConnection) {
              const playerRoom = gameRooms.get(playerConnection.roomId)
              if (playerRoom) {
                const player = playerRoom.players.get(playerConnection.playerId)
                if (player && player.isAlive) {
                  const { direction } = data
                  const opposites = {
                    'up': 'down',
                    'down': 'up',
                    'left': 'right',
                    'right': 'left'
                  }
                  
                  if (direction !== opposites[player.direction as keyof typeof opposites]) {
                    player.direction = direction
                  }
                }
              }
            }
            break
            
          case 'leaveRoom':
            const leavingConnection = Array.from(playerConnections.values()).find(conn => conn.ws === ws)
            if (leavingConnection) {
              removePlayerFromRoom(leavingConnection.roomId, leavingConnection.playerId)
              playerConnections.delete(leavingConnection.playerId)
              
              broadcastToRoom(leavingConnection.roomId, {
                type: 'playerLeft',
                playerId: leavingConnection.playerId
              })
            }
            break
        }
      } catch (error) {
        console.error('Message handling error:', error)
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Invalid message format'
        }))
      }
    },
    close(ws) {
      console.log('WebSocket connection closed')
      
      // Check if it's an admin connection
      const adminConnection = Array.from(adminConnections.values()).find(conn => conn.ws === ws)
      if (adminConnection) {
        adminConnections.delete(adminConnection.clientId)
        console.log(`Admin client ${adminConnection.clientId} disconnected`)
        return
      }
      
      // Check if it's a game connection
      const gameConnection = Array.from(playerConnections.values()).find(conn => conn.ws === ws)
      if (gameConnection) {
        removePlayerFromRoom(gameConnection.roomId, gameConnection.playerId)
        playerConnections.delete(gameConnection.playerId)
        
        broadcastToRoom(gameConnection.roomId, {
          type: 'playerLeft',
          playerId: gameConnection.playerId
        })
      }
    }
  }
})

// Keep-alive mechanism for admin connections
setInterval(() => {
  broadcastToAdmins({
    type: 'ping',
    timestamp: Date.now()
  })
}, 30000)

console.log(`Enhanced Snake Game & Square Webhook Server running at http://localhost:${server.port}`)
console.log('WebSocket endpoint: ws://localhost:3000')
console.log('Square webhook endpoint: http://localhost:3000/webhooks/square')
console.log('Health check: http://localhost:3000/health')
console.log('Status check: http://localhost:3000/status')
console.log('Test endpoint: http://localhost:3000/test')
console.log('Game rooms active:', gameRooms.size)
console.log('Admin connections:', adminConnections.size)
