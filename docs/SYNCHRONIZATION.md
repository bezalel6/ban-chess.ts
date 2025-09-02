# Ban Chess Synchronization Guide

This guide explains how to synchronize Ban Chess game state between multiple clients (e.g., for online multiplayer, spectator mode, or game analysis).

## Overview

Ban Chess provides a standardized serialization format for actions and state synchronization methods to enable efficient network communication between clients. The v3.0.0 ply-based API makes synchronization state clearer and more reliable.

## Serialized Action Format (BCN - Ban Chess Notation)

Each action in Ban Chess can be represented as a compact string:

- **Ban**: `b:fromto` (e.g., `b:e2e4`)
- **Move**: `m:fromto[promotion]` (e.g., `m:d2d4` or `m:e7e8q`)
- **With indicators**: Game state indicators (+, #, =) can be included (configurable)

This format is:
- Compact (6-8 characters per action)
- Unambiguous (fully describes the action)
- Easy to parse and validate
- Network-friendly (plain ASCII strings)

## Core Synchronization Methods

### Serializing Actions

```typescript
import { BanChess } from 'ban-chess.ts';

// Serialize any action
const action = { ban: { from: 'e2', to: 'e4' } };
const serialized = BanChess.serializeAction(action); // "b:e2e4"

// Deserialize back to action object
const deserialized = BanChess.deserializeAction(serialized);
```

### Getting Sync State

```typescript
const game = new BanChess();
// ... play some moves ...

// Get minimal state for synchronization
const syncState = game.getSyncState();
// Returns: { fen: string, lastAction?: string, moveNumber: number }
```

### Applying Serialized Actions

```typescript
const game = new BanChess();

// Apply a serialized action directly
const result = game.playSerializedAction('b:e2e4');
if (result.success) {
  console.log('Action applied successfully');
  // v3.0.0: Use ply-based API for clearer state tracking
  console.log(`Now at ply ${game.getPly()}: ${game.getActivePlayer()} to ${game.getActionType()}`);
}
```

## Synchronization Patterns

### Pattern 1: Incremental Updates (Recommended)

Best for real-time multiplayer with reliable connection.

**Client A (sends action):**
```typescript
const game = new BanChess();
const action = { ban: { from: 'e2', to: 'e4' } };
const result = game.play(action);

if (result.success) {
  // Send only the action to other clients
  websocket.send(JSON.stringify({
    type: 'action',
    data: BanChess.serializeAction(action)
  }));
}
```

**Client B (receives action):**
```typescript
websocket.on('message', (msg) => {
  const { type, data } = JSON.parse(msg);
  if (type === 'action') {
    const result = game.playSerializedAction(data);
    if (!result.success) {
      // Request full sync if action fails
      requestFullSync();
    }
  }
});
```

### Pattern 2: Full State Sync

Best for recovery from disconnections or initial game join.

**Server/Host:**
```typescript
function handleClientJoin(clientId: string) {
  const syncState = game.getSyncState();
  sendToClient(clientId, {
    type: 'full-sync',
    data: syncState
  });
}
```

**Client:**
```typescript
function handleFullSync(syncState: SyncState) {
  game.loadFromSyncState(syncState);
  // Now client is fully synchronized
}
```

### Pattern 3: Action History Replay

Best for game analysis, replay systems, or persistent storage.

```typescript
// Save game as action history
const actions = game.getActionHistory();
localStorage.setItem('game', JSON.stringify(actions));

// Load and replay game
const savedActions = JSON.parse(localStorage.getItem('game'));
const replayedGame = BanChess.replayFromActions(savedActions);
```

## WebSocket Implementation Example

```typescript
// Server
class BanChessServer {
  private game = new BanChess();
  private clients = new Set<WebSocket>();
  
  handleConnection(ws: WebSocket) {
    // Send current state to new client
    ws.send(JSON.stringify({
      type: 'init',
      data: this.game.getSyncState()
    }));
    
    this.clients.add(ws);
    
    ws.on('message', (msg) => {
      const { action } = JSON.parse(msg);
      const result = this.game.playSerializedAction(action);
      
      if (result.success) {
        // Broadcast to all clients
        this.broadcast({
          type: 'action',
          data: action,
          result: result
        });
      } else {
        // Send error to sender only
        ws.send(JSON.stringify({
          type: 'error',
          error: result.error
        }));
      }
    });
  }
  
  broadcast(message: any) {
    const data = JSON.stringify(message);
    this.clients.forEach(client => client.send(data));
  }
}

// Client
class BanChessClient {
  private game = new BanChess();
  private ws: WebSocket;
  
  connect(url: string) {
    this.ws = new WebSocket(url);
    
    this.ws.on('message', (msg) => {
      const message = JSON.parse(msg);
      
      switch (message.type) {
        case 'init':
          this.game.loadFromSyncState(message.data);
          break;
        
        case 'action':
          this.game.playSerializedAction(message.data);
          this.updateUI();
          break;
        
        case 'error':
          console.error('Action failed:', message.error);
          this.requestSync();
          break;
      }
    });
  }
  
  sendAction(action: Action) {
    const serialized = BanChess.serializeAction(action);
    this.ws.send(JSON.stringify({ action: serialized }));
  }
  
  requestSync() {
    this.ws.send(JSON.stringify({ type: 'sync-request' }));
  }
}
```

## REST API Implementation Example

```typescript
// Server endpoints
app.get('/api/game/:id/state', (req, res) => {
  const game = getGame(req.params.id);
  res.json(game.getSyncState());
});

app.post('/api/game/:id/action', (req, res) => {
  const game = getGame(req.params.id);
  const { action } = req.body;
  
  const result = game.playSerializedAction(action);
  
  if (result.success) {
    res.json({
      success: true,
      newState: game.getSyncState()
    });
  } else {
    res.status(400).json({
      success: false,
      error: result.error
    });
  }
});

app.get('/api/game/:id/history', (req, res) => {
  const game = getGame(req.params.id);
  res.json({
    actions: game.getActionHistory(),
    currentState: game.getSyncState()
  });
});

// Client
class BanChessAPIClient {
  async loadGame(gameId: string) {
    const response = await fetch(`/api/game/${gameId}/state`);
    const syncState = await response.json();
    this.game.loadFromSyncState(syncState);
  }
  
  async sendAction(gameId: string, action: Action) {
    const response = await fetch(`/api/game/${gameId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: BanChess.serializeAction(action)
      })
    });
    
    const result = await response.json();
    if (result.success) {
      this.game.loadFromSyncState(result.newState);
    }
    return result;
  }
}
```

## Conflict Resolution

When clients get out of sync:

1. **Detect desync**: Action application fails
2. **Request full state**: Client requests current state from authoritative source
3. **Reset local state**: Replace local state with authoritative state
4. **Resume play**: Continue with synchronized state

```typescript
class ConflictResolver {
  async handleActionFailure(action: SerializedAction) {
    console.log(`Action ${action} failed, requesting sync...`);
    
    // Get authoritative state
    const syncState = await this.requestAuthoritativeState();
    
    // Reset local game
    this.game.loadFromSyncState(syncState);
    
    // Notify user
    this.notifyUser('Game synchronized with server');
  }
}
```

## Best Practices

1. **Always validate actions** before sending over network
2. **Use incremental updates** when possible (less bandwidth)
3. **Implement full sync** as fallback for recovery
4. **Store action history** for replay and analysis
5. **Handle network failures** gracefully with retries
6. **Consider using compression** for large sync states
7. **Implement checksums** to detect desyncs early

## Performance Considerations

- **Serialized actions**: 6-8 bytes each
- **Sync state**: ~100-150 bytes (FEN + metadata)
- **Full game history**: ~8 bytes × number of actions
- **Network overhead**: Minimal with incremental updates

## Security Considerations

1. **Validate all inputs**: Check serialized actions format
2. **Authorize actions**: Ensure player can make the action
3. **Rate limiting**: Prevent spam/DOS attacks
4. **State validation**: Verify game state consistency
5. **Use TLS**: Encrypt network communication

## Troubleshooting

**Problem**: Actions fail on remote client
**Solution**: Request full sync state

**Problem**: Clients showing different positions
**Solution**: Compare FEN strings, resync from authoritative source

**Problem**: High bandwidth usage
**Solution**: Use incremental updates instead of full state

**Problem**: Replay fails mid-game
**Solution**: Check for rule changes or validate action sequence