import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Zap, Wallet, AlertCircle, Frown, Coins, History as HistoryIcon, Star } from 'lucide-react';
import confetti from 'canvas-confetti';
import { cn } from '../lib/utils';
import { User } from 'firebase/auth';
import { translations, Language } from '../translations';

interface Prize {
  id: number;
  label: string;
  value: number;
  color: string;
  textColor: string;
}

const PRIZES: Prize[] = [
  { id: 0, label: "5 $", value: 5, color: "#f9a8d4", textColor: "#1a1a1a" },
  { id: 1, label: "1 $", value: 1, color: "#93c5fd", textColor: "#1a1a1a" },
  { id: 2, label: "EMPTY", value: 0, color: "#86efac", textColor: "#1a1a1a" },
  { id: 3, label: "2 $", value: 2, color: "#fde047", textColor: "#1a1a1a" },
  { id: 4, label: "3 $", value: 3, color: "#c4b5fd", textColor: "#1a1a1a" },
  { id: 5, label: "1 $", value: 1, color: "#fdba74", textColor: "#1a1a1a" },
  { id: 6, label: "5 $", value: 5, color: "#5eead4", textColor: "#1a1a1a" },
  { id: 7, label: "EMPTY", value: 0, color: "#a5b4fc", textColor: "#1a1a1a" },
  { id: 8, label: "2 $", value: 2, color: "#fda4af", textColor: "#1a1a1a" },
  { id: 9, label: "3 $", value: 3, color: "#67e8f9", textColor: "#1a1a1a" },
];

interface LuckyWheelProps {
  onSpinRequest: () => void;
  onWin: (amount: number) => void;
  onFreeSpin: () => void;
  onWalletSpin: () => void;
  onDailySpin: () => void;
  isProcessing: boolean;
  hasUsedFreeSpin: boolean;
  walletBalance: number;
  triggerWheelSpin: number;
  user: User | null;
  dailySpins: number;
  lang: Language;
}

export const LuckyWheel: React.FC<LuckyWheelProps> = ({ 
  onSpinRequest, 
  onWin, 
  onFreeSpin, 
  onWalletSpin,
  onDailySpin,
  isProcessing, 
  hasUsedFreeSpin, 
  walletBalance,
  triggerWheelSpin,
  user,
  dailySpins,
  lang
}) => {
  const t = translations[lang];
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<Prize | null>(null);
  const [showOverlay, setShowOverlay] = useState(false);
  const [isWinner, setIsWinner] = useState(false);

  const spin = () => {
    if (isSpinning) return;
    setIsSpinning(true);
    setResult(null);
    setShowOverlay(false);

    const prizeIndex = Math.floor(Math.random() * PRIZES.length);
    const prize = PRIZES[prizeIndex];
    const segmentAngle = 360 / PRIZES.length;
    const extraSpins = 8 + Math.floor(Math.random() * 5);
    const targetRotation = rotation + (extraSpins * 360) + (360 - (prizeIndex * segmentAngle)) - (segmentAngle / 2);

    setRotation(targetRotation);

    setTimeout(() => {
      setIsSpinning(false);
      setResult(prize);
      setIsWinner(prize.value > 0);
      setShowOverlay(true);
      if (prize.value > 0) {
        onWin(prize.value);
        // Variable animated confetti
        const duration = 3 * 1000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

        const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

        const interval: any = setInterval(function() {
          const timeLeft = animationEnd - Date.now();

          if (timeLeft <= 0) {
            return clearInterval(interval);
          }

          const particleCount = 50 * (timeLeft / duration);
          confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
          confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
        }, 250);
      }
    }, 5000);
  };

  React.useEffect(() => {
    if (triggerWheelSpin > 0) spin();
  }, [triggerWheelSpin]);

  return (
    <div className="space-y-8 py-4">
      <AnimatePresence>
        {showOverlay && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl">
            <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} className={cn("w-full max-w-md p-8 rounded-[40px] text-center space-y-6", isWinner ? "bg-brand-500" : "bg-zinc-900")}>
              <div className="flex justify-center">
                <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center text-brand-500">
                  {isWinner ? <Trophy size={40} /> : <Frown size={40} />}
                </div>
              </div>
              <h2 className="text-3xl font-black text-white">{isWinner ? `${result?.label === 'EMPTY' ? t.empty : result?.label} ${t.wheelWin}` : t.wheelLose}</h2>
              {isWinner && (
                <div className="p-4 bg-white/10 rounded-2xl text-white/80 text-sm font-medium">
                  {t.wheelRewardAdded}
                </div>
              )}
              <button onClick={() => setShowOverlay(false)} className="w-full py-4 bg-white text-brand-500 font-bold rounded-2xl">{t.close}</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative flex flex-col items-center justify-center py-10">
        <div className="relative" onContextMenu={(e) => e.preventDefault()}>
          <motion.div animate={{ rotate: rotation }} transition={{ duration: 5, ease: "circOut" }} className="w-72 h-72 md:w-80 md:h-80 rounded-full border-8 border-white/10 relative overflow-hidden shadow-[0_0_50px_rgba(244,63,94,0.2)]" style={{ background: `conic-gradient(${PRIZES.map((p, i) => `${p.color} ${i * 36}deg ${(i+1) * 36}deg`).join(', ')})` }}>
            {/* Segment Dividers */}
            {PRIZES.map((_, i) => (
              <div key={`line-${i}`} className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-full bg-white/20 z-0" style={{ transform: `rotate(${i * 36}deg)` }} />
            ))}
            
            {/* Prizes */}
            {PRIZES.map((prize, i) => (
              <div key={prize.id} className="absolute inset-0 flex items-start justify-center z-10" style={{ transform: `rotate(${i * 36 + 18}deg)` }}>
                <div className="mt-8 md:mt-10 flex flex-col items-center gap-1 rotate-90">
                  <span className="font-black text-lg md:text-xl uppercase tracking-tighter leading-none drop-shadow-lg" style={{ color: prize.textColor }}>{prize.label === 'EMPTY' ? t.empty : prize.label}</span>
                </div>
              </div>
            ))}
          </motion.div>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 w-8 h-10 bg-brand-500 rounded-b-full z-20 shadow-lg">
            <div className="w-2 h-2 bg-white rounded-full mx-auto mt-1 animate-pulse" />
          </div>
          <div className="absolute inset-0 rounded-full border border-white/20 pointer-events-none" />
        </div>
      </div>

      <div className="space-y-4">
        {user && (
          <div className="glass-panel p-6 rounded-3xl border border-brand-500/20 bg-brand-500/5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-brand-500 rounded-xl flex items-center justify-center shadow-lg shadow-brand-500/20">
                  <Star className="w-6 h-6 text-white fill-white" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-tight">{t.dailyBonus}</h3>
                  <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">{t.every24h}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black text-brand-400">{dailySpins}</div>
                <div className="text-[8px] font-black uppercase tracking-widest text-white/20">{t.remainingRights}</div>
              </div>
            </div>
            
            <button 
              disabled={isSpinning || isProcessing || dailySpins <= 0} 
              onClick={onDailySpin} 
              className={cn(
                "w-full py-4 font-black rounded-xl shadow-xl transition-all flex items-center justify-center gap-3",
                dailySpins > 0 
                  ? "bg-white text-black hover:bg-brand-500 hover:text-white" 
                  : "bg-white/5 text-white/20 border border-white/5 cursor-not-allowed"
              )}
            >
              <Zap className="w-4 h-4 fill-current" /> {t.useDailySpin}
            </button>
          </div>
        )}

        {user && !hasUsedFreeSpin ? (
          <button 
            disabled={isSpinning || isProcessing} 
            onClick={onFreeSpin} 
            className="w-full py-5 bg-gradient-to-r from-brand-500 to-brand-600 text-white font-black rounded-2xl shadow-xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
          >
            <Zap className="w-5 h-5 fill-current" /> {t.freeTrialSpin}
          </button>
        ) : (
          <div className="space-y-4">
            {!user && !hasUsedFreeSpin && (
              <div className="p-4 bg-brand-500/10 border border-brand-500/20 rounded-2xl flex items-center justify-between gap-4">
                <p className="text-[10px] text-white/60 font-bold uppercase tracking-wider">{t.loginForFreeSpin}</p>
                <div className="flex items-center gap-1 text-brand-400 animate-pulse">
                  <Star className="w-3 h-3 fill-current" />
                  <span className="text-[10px] font-black uppercase">{t.gift}</span>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between px-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-white/40">{t.paymentOptions}</span>
              <div className="flex items-center gap-2 px-3 py-1 bg-brand-500/10 border border-brand-500/20 rounded-full">
                <Wallet className="w-3 h-3 text-brand-400" />
                <span className="text-[10px] font-black text-brand-400">{t.wallet}: {walletBalance.toFixed(2)} $</span>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button 
                disabled={isSpinning || isProcessing} 
                onClick={onSpinRequest} 
                className="w-full py-5 bg-brand-500 text-white font-black rounded-2xl shadow-xl hover:bg-brand-600 transition-all disabled:opacity-50"
              >
                {t.spinWith1}
              </button>
              <button 
                disabled={isSpinning || isProcessing || walletBalance < 1} 
                onClick={onWalletSpin} 
                className={cn(
                  "w-full py-5 font-black rounded-2xl shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2",
                  walletBalance >= 1 
                    ? "bg-zinc-800 text-brand-400 border border-brand-500/30 hover:bg-zinc-700" 
                    : "bg-zinc-900 text-white/20 border border-white/5 cursor-not-allowed"
                )}
              >
                <Wallet className="w-4 h-4" /> {t.payWithWallet} (1 $)
              </button>
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-white/5 border border-white/10 rounded-2xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-brand-400 shrink-0 mt-0.5" />
            <p className="text-[10px] text-white/60 leading-relaxed uppercase tracking-wider font-bold">
              {t.rewardsInternalOnly}
            </p>
          </div>
          <div className="p-4 bg-white/5 border border-white/10 rounded-2xl flex items-start gap-3">
            <HistoryIcon className="w-5 h-5 text-brand-400 shrink-0 mt-0.5" />
            <p className="text-[10px] text-white/60 leading-relaxed uppercase tracking-wider font-bold">
              {t.rewardsExpire60}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
