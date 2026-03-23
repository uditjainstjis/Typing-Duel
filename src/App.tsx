import React, { useState, useEffect, useRef, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import { nanoid } from 'nanoid';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Users, Keyboard, Timer, RefreshCcw, Share2, ChevronRight, Zap, Target, ArrowRight, Settings, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from './lib/utils';
import { Room, Player, GameMode } from './types';

const socket: Socket = io();

export default function App() {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [nickname, setNickname] = useState('');
  const [room, setRoom] = useState<Room | null>(null);
  const [userInput, setUserInput] = useState('');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [wpm, setWpm] = useState(0);
  const [accuracy, setAccuracy] = useState(100);
  const [isJoined, setIsJoined] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('room');
    if (id) {
      setRoomId(id);
    }

    socket.on('room-update', (updatedRoom: Room) => {
      setRoom(updatedRoom);
      if (updatedRoom.status === 'waiting') {
        setUserInput('');
        setStartTime(null);
        setWpm(0);
        setAccuracy(100);
      }
    });

    socket.on('countdown', (count: number) => {
      setCountdown(count);
    });

    return () => {
      socket.off('room-update');
      socket.off('countdown');
    };
  }, []);

  useEffect(() => {
    if (room?.status === 'playing' && room.startTime) {
      if (!startTime) setStartTime(room.startTime);
      inputRef.current?.focus();

      if (room.gameMode === 'time') {
        const interval = setInterval(() => {
          const elapsed = (Date.now() - room.startTime!) / 1000;
          const remaining = Math.max(0, room.duration - elapsed);
          setTimeLeft(Math.ceil(remaining));
          if (remaining <= 0) clearInterval(interval);
        }, 100);
        return () => clearInterval(interval);
      }
    } else {
      setTimeLeft(null);
    }
  }, [room?.status, room?.startTime, room?.gameMode, room?.duration, startTime]);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) return;

    const id = roomId || nanoid(6);
    setRoomId(id);
    window.history.pushState({}, '', `?room=${id}`);
    socket.emit('join-room', { roomId: id, nickname });
    setIsJoined(true);
  };

  const handleStart = () => {
    if (room) {
      socket.emit('start-game', room.id);
    }
  };

  const handleRematch = () => {
    if (room) {
      socket.emit('request-rematch', room.id);
    }
  };

  const handleNewText = () => {
    if (room) {
      socket.emit('new-text', room.id);
    }
  };

  const handleSettingsChange = (gameMode: GameMode, duration: number) => {
    if (room) {
      socket.emit('change-settings', { roomId: room.id, gameMode, duration });
    }
  };

  const calculateStats = (input: string) => {
    if (!room || !startTime) return;

    const targetText = room.snippet.text;
    let correctChars = 0;
    for (let i = 0; i < input.length; i++) {
      if (input[i] === targetText[i]) {
        correctChars++;
      }
    }

    const accuracyVal = input.length > 0 ? Math.round((correctChars / input.length) * 100) : 100;
    const timeElapsed = (Date.now() - startTime) / 1000 / 60; // in minutes
    const wordsTyped = input.length / 5;
    const wpmVal = timeElapsed > 0 ? Math.round(wordsTyped / timeElapsed) : 0;

    setAccuracy(accuracyVal);
    setWpm(wpmVal);

    const progress = Math.min(Math.round((input.length / targetText.length) * 100), 100);
    
    socket.emit('update-progress', {
      roomId: room.id,
      progress,
      wpm: wpmVal,
      accuracy: accuracyVal
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (room?.status !== 'playing') return;
    
    const val = e.target.value;
    setUserInput(val);
    calculateStats(val);
  };

  const copyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const renderText = () => {
    if (!room) return null;
    const targetText = room.snippet.text;
    
    return (
      <div className="text-2xl font-mono leading-relaxed tracking-wide select-none">
        {targetText.split('').map((char, i) => {
          let colorClass = "text-zinc-500";
          if (i < userInput.length) {
            colorClass = userInput[i] === char ? "text-emerald-400" : "text-rose-500 bg-rose-500/20";
          }
          return (
            <span key={i} className={cn(colorClass, i === userInput.length && "border-l-2 border-emerald-400 animate-pulse")}>
              {char}
            </span>
          );
        })}
      </div>
    );
  };

  const myPlayer = room?.players.find(p => p.id === socket.id);
  const otherPlayers = room?.players.filter(p => p.id !== socket.id) || [];
  const rematchRequestedByMe = myPlayer?.rematchRequested;
  const rematchRequestedByOthers = otherPlayers.some(p => p.rematchRequested);

  if (!isJoined) {
    return (
      <div className="min-h-screen bg-[#09090b] text-zinc-100 flex items-center justify-center p-4 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full space-y-8 bg-zinc-900/50 p-8 rounded-3xl border border-zinc-800 backdrop-blur-xl"
        >
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-4">
              <Keyboard className="w-8 h-8 text-emerald-400" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-white">TypeDuel</h1>
            <p className="text-zinc-400">Prove your speed in real-time combat.</p>
          </div>

          <form onSubmit={handleJoin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-widest text-zinc-500 ml-1">Your Nickname</label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="e.g. SpeedDemon"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-white placeholder:text-zinc-700"
                autoFocus
              />
            </div>
            <button
              type="submit"
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 group"
            >
              {roomId ? 'Join Duel' : 'Create Duel'}
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </form>

          <div className="pt-6 border-t border-zinc-800">
            <div className="flex items-center gap-4 text-sm text-zinc-500">
              <div className="flex -space-x-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="w-8 h-8 rounded-full bg-zinc-800 border-2 border-zinc-900 flex items-center justify-center">
                    <Users className="w-4 h-4" />
                  </div>
                ))}
              </div>
              <span>Join 1,200+ active duelists</span>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 font-sans p-4 md:p-8 overflow-x-hidden">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900/30 p-6 rounded-3xl border border-zinc-800/50">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-500/10 rounded-2xl">
              <Keyboard className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">TypeDuel Arena</h1>
              <p className="text-xs text-zinc-500 uppercase tracking-widest font-semibold">Room: {room?.id}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={copyLink}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors text-sm font-medium border border-zinc-700"
            >
              <Share2 className="w-4 h-4" />
              {copySuccess ? 'Copied!' : 'Invite Friend'}
            </button>
            {room?.status === 'waiting' && (
              <button
                onClick={handleStart}
                className="flex items-center gap-2 px-6 py-2 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 rounded-xl transition-all font-bold shadow-lg shadow-emerald-500/20"
              >
                <Zap className="w-4 h-4" />
                Start Race
              </button>
            )}
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Arena */}
          <div className="lg:col-span-2 space-y-8">
            {/* Mode Settings (Only in waiting) */}
            {room?.status === 'waiting' && (
              <div className="bg-zinc-900/30 p-6 rounded-3xl border border-zinc-800/50 flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-zinc-500" />
                  <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">Settings</span>
                </div>
                
                <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800">
                  <button
                    onClick={() => handleSettingsChange('completion', room.duration)}
                    className={cn(
                      "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                      room.gameMode === 'completion' ? "bg-emerald-500 text-emerald-950" : "text-zinc-500 hover:text-zinc-300"
                    )}
                  >
                    First to Finish
                  </button>
                  <button
                    onClick={() => handleSettingsChange('time', room.duration)}
                    className={cn(
                      "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                      room.gameMode === 'time' ? "bg-emerald-500 text-emerald-950" : "text-zinc-500 hover:text-zinc-300"
                    )}
                  >
                    Time Attack
                  </button>
                </div>

                {room.gameMode === 'time' && (
                  <div className="flex items-center gap-3">
                    {[30, 60, 120].map(d => (
                      <button
                        key={d}
                        onClick={() => handleSettingsChange('time', d)}
                        className={cn(
                          "w-10 h-10 rounded-xl text-xs font-bold border transition-all",
                          room.duration === d ? "bg-zinc-100 text-zinc-950 border-zinc-100" : "bg-zinc-900 text-zinc-500 border-zinc-800 hover:border-zinc-700"
                        )}
                      >
                        {d}s
                      </button>
                    ))}
                  </div>
                )}

                <button
                  onClick={handleNewText}
                  className="ml-auto flex items-center gap-2 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  <RefreshCcw className="w-3 h-3" />
                  New Text
                </button>
              </div>
            )}

            {/* Progress Tracks */}
            <div className="bg-zinc-900/30 p-8 rounded-3xl border border-zinc-800/50 space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">Live Progress</h2>
                {timeLeft !== null && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-rose-500/10 border border-rose-500/20 rounded-full">
                    <Clock className="w-3 h-3 text-rose-400" />
                    <span className="text-xs font-mono font-bold text-rose-400">{timeLeft}s</span>
                  </div>
                )}
              </div>
              <div className="space-y-8">
                {room?.players.map((player) => (
                  <div key={player.id} className="space-y-2">
                    <div className="flex justify-between items-end">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "text-sm font-bold",
                          player.id === socket.id ? "text-emerald-400" : "text-zinc-300"
                        )}>
                          {player.nickname} {player.id === socket.id && "(You)"}
                        </span>
                        {player.isFinished && <Trophy className="w-4 h-4 text-amber-400" />}
                      </div>
                      <div className="flex gap-4 text-xs font-mono text-zinc-500">
                        <span>{player.wpm} WPM</span>
                        <span>{player.accuracy}% ACC</span>
                      </div>
                    </div>
                    <div className="h-2 w-full bg-zinc-800/50 rounded-full overflow-hidden border border-zinc-800">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${player.progress}%` }}
                        className={cn(
                          "h-full rounded-full transition-all duration-300",
                          player.id === socket.id ? "bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]" : "bg-zinc-600"
                        )}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Typing Area */}
            <div className="relative bg-zinc-900/50 p-10 rounded-[2.5rem] border border-zinc-800 min-h-[300px] flex flex-col justify-center shadow-2xl">
              <AnimatePresence mode="wait">
                {countdown !== null && countdown > 0 && (
                  <motion.div
                    key="countdown"
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 1.5, opacity: 0 }}
                    className="absolute inset-0 flex items-center justify-center z-10 bg-[#09090b]/80 backdrop-blur-sm rounded-[2.5rem]"
                  >
                    <span className="text-9xl font-black text-emerald-500 italic">{countdown}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="relative z-0">
                {room?.status === 'waiting' ? (
                  <div className="text-center space-y-4 py-12">
                    <div className="w-16 h-16 bg-zinc-800 rounded-2xl flex items-center justify-center mx-auto animate-pulse">
                      <Users className="w-8 h-8 text-zinc-600" />
                    </div>
                    <p className="text-zinc-500 font-medium">Waiting for duelists to join...</p>
                    <p className="text-xs text-zinc-600 uppercase tracking-widest">Invite link: {window.location.href}</p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="px-3 py-1 bg-zinc-800 text-zinc-400 rounded-full text-[10px] font-bold uppercase tracking-wider border border-zinc-700">
                        {room?.snippet.difficulty} Mode
                      </span>
                      <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full text-[10px] font-bold uppercase tracking-wider border border-emerald-500/20">
                        {room?.gameMode === 'completion' ? 'First to Finish' : `Time Attack (${room?.duration}s)`}
                      </span>
                    </div>
                    {renderText()}
                    <input
                      ref={inputRef}
                      type="text"
                      value={userInput}
                      onChange={handleInputChange}
                      disabled={room?.status !== 'playing' || room.players.find(p => p.id === socket.id)?.isFinished}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-default"
                      autoFocus
                    />
                    {room?.status === 'playing' && (
                      <div className="pt-8 flex items-center gap-6 border-t border-zinc-800/50">
                        <div className="flex items-center gap-2">
                          <Zap className="w-4 h-4 text-emerald-400" />
                          <span className="text-2xl font-black text-white">{wpm}</span>
                          <span className="text-xs font-bold text-zinc-500 uppercase tracking-tighter mt-1">WPM</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Target className="w-4 h-4 text-emerald-400" />
                          <span className="text-2xl font-black text-white">{accuracy}%</span>
                          <span className="text-xs font-bold text-zinc-500 uppercase tracking-tighter mt-1">ACC</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar / Leaderboard */}
          <div className="space-y-8">
            <div className="bg-zinc-900/30 p-6 rounded-3xl border border-zinc-800/50 h-full">
              <div className="flex items-center gap-2 mb-6">
                <Trophy className="w-5 h-5 text-amber-400" />
                <h2 className="text-sm font-bold uppercase tracking-widest text-white">Standings</h2>
              </div>
              
              <div className="space-y-4">
                {room?.players
                  .sort((a, b) => (b.progress - a.progress) || (b.wpm - a.wpm))
                  .map((player, idx) => (
                    <div key={player.id} className={cn(
                      "flex items-center justify-between p-4 rounded-2xl border transition-all",
                      player.id === socket.id ? "bg-emerald-500/5 border-emerald-500/20" : "bg-zinc-800/20 border-zinc-800"
                    )}>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-black text-zinc-600 w-4">{idx + 1}</span>
                        <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-400">
                          {player.nickname[0].toUpperCase()}
                        </div>
                        <span className="text-sm font-bold text-zinc-200">{player.nickname}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-black text-white">{player.wpm} WPM</div>
                        <div className="text-[10px] font-bold text-zinc-500 uppercase">{player.isFinished ? 'Finished' : `${player.progress}%`}</div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Results Modal */}
      <AnimatePresence>
        {room?.status === 'finished' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#09090b]/90 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="max-w-2xl w-full bg-zinc-900 border border-zinc-800 rounded-[3rem] p-10 shadow-[0_0_100px_rgba(16,185,129,0.1)] space-y-10"
            >
              <div className="text-center space-y-4">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 mb-2">
                  <Trophy className="w-10 h-10 text-emerald-400" />
                </div>
                <h2 className="text-5xl font-black tracking-tighter text-white italic uppercase">Duel Over!</h2>
                <p className="text-zinc-400 font-medium">Here's how the battle went down.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {room.players
                  .sort((a, b) => (b.progress - a.progress) || (b.wpm - a.wpm))
                  .map((p, i) => (
                    <div key={p.id} className={cn(
                      "p-6 rounded-3xl border flex flex-col gap-4",
                      i === 0 ? "bg-emerald-500/5 border-emerald-500/20 ring-1 ring-emerald-500/20" : "bg-zinc-950 border-zinc-800"
                    )}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-black text-zinc-700">#{i + 1}</span>
                          <span className="font-bold text-white">{p.nickname}</span>
                        </div>
                        {i === 0 && <span className="px-2 py-0.5 bg-emerald-500 text-emerald-950 text-[10px] font-black rounded-full uppercase">Winner</span>}
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-zinc-900/50 p-3 rounded-2xl border border-zinc-800/50">
                          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Speed</div>
                          <div className="text-xl font-black text-white">{p.wpm} <span className="text-xs opacity-50">WPM</span></div>
                        </div>
                        <div className="bg-zinc-900/50 p-3 rounded-2xl border border-zinc-800/50">
                          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Accuracy</div>
                          <div className="text-xl font-black text-white">{p.accuracy}%</div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>

              <div className="flex flex-col md:flex-row gap-4 pt-6 border-t border-zinc-800">
                <button
                  onClick={handleRematch}
                  disabled={rematchRequestedByMe}
                  className={cn(
                    "flex-1 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all",
                    rematchRequestedByMe 
                      ? "bg-zinc-800 text-zinc-500 cursor-not-allowed" 
                      : "bg-emerald-500 hover:bg-emerald-400 text-emerald-950 shadow-lg shadow-emerald-500/20"
                  )}
                >
                  {rematchRequestedByMe ? (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      Waiting for Friend...
                    </>
                  ) : (
                    <>
                      <RefreshCcw className="w-5 h-5" />
                      Request Rematch
                    </>
                  )}
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="flex-1 py-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-2xl font-bold transition-all"
                >
                  Leave Arena
                </button>
              </div>

              {rematchRequestedByOthers && !rematchRequestedByMe && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-center gap-2 text-emerald-400 font-bold text-sm animate-bounce"
                >
                  <AlertCircle className="w-4 h-4" />
                  Your friend wants a rematch!
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
