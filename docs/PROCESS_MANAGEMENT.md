# Process Management Guide

## Problem Solved
The bot was creating multiple zombie processes (Node and Chrome) that weren't being cleaned up properly, leading to resource exhaustion and conflicts.

## Solution Implemented

### 1. Bot Manager Script (`bot-manager.sh`)
A comprehensive process management script that handles:
- **Start**: Clean startup with PID tracking
- **Stop**: Graceful shutdown with timeout fallback
- **Restart**: Clean restart
- **Status**: Process monitoring
- **Logs**: Real-time log viewing
- **Clean**: Deep clean of all processes

### 2. Graceful Shutdown in Code
Enhanced `src/index.ts` with:
- Multiple signal handlers (SIGINT, SIGTERM, SIGUSR2)
- 5-second timeout for cleanup
- Prevents multiple shutdown attempts
- Proper Chrome browser cleanup

### 3. Chrome Process Optimization
Updated `src/config/whatsapp.config.ts` with:
- `--single-process` flag to prevent zombie processes
- Signal handlers for Chrome process
- Memory optimization flags

## Usage

### Basic Commands
```bash
# Start the bot
./bot-manager.sh start

# Stop the bot gracefully
./bot-manager.sh stop

# Restart the bot
./bot-manager.sh restart

# Check status
./bot-manager.sh status

# View logs in real-time
./bot-manager.sh logs

# Emergency cleanup (kills ALL node/chrome)
./bot-manager.sh clean
```

### Process Management Features

1. **PID Tracking**: The script maintains a `.bot.pid` file to track the main process
2. **Graceful Shutdown**: Tries SIGTERM first, then SIGKILL after 10 seconds
3. **Process Cleanup**: Automatically cleans up related Chrome processes
4. **Auth Directory Management**: Cleans auth directory when no process is using it
5. **Status Monitoring**: Shows memory usage and related processes

### Troubleshooting

#### If processes accumulate:
```bash
# Emergency cleanup
./bot-manager.sh clean
```

#### If bot won't stop:
```bash
# Force kill all related processes
killall -9 node chromium chrome
rm -f .bot.pid
```

#### To monitor processes:
```bash
# Watch process count
watch -n 1 'ps aux | grep -E "(node|chrome)" | grep -v grep | wc -l'
```

## Best Practices

1. **Always use bot-manager.sh** instead of `npm start` directly
2. **Check status** before starting to avoid duplicates
3. **Use clean** sparingly as it kills ALL node/chrome processes
4. **Monitor logs** for any shutdown errors
5. **Regular restarts** if running for extended periods

## Files Created

- `bot-manager.sh`: Main management script
- `.bot.pid`: Process ID tracking (auto-generated)
- Enhanced shutdown handling in TypeScript code

This solution ensures clean process management and prevents the accumulation of zombie processes.