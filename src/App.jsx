import React, { useState, useEffect, useMemo } from 'react';
import { 
  Trophy, Search, RefreshCw, Key, Filter, ShoppingBag, 
  TrendingUp, Sun, Moon, CheckCircle2, AlertCircle, Trash2, 
  DollarSign, Activity, Zap, ExternalLink, ChevronRight
} from 'lucide-react';

// --- Default Mock Data for immediate offline/preview mode ---
const MOCK_SPORTS = [
  { key: 'soccer_epl', group: 'Soccer', title: 'Premier League', description: 'UK Football' },
  { key: 'soccer_usa_mls', group: 'Soccer', title: 'MLS', description: 'US Football' },
  { key: 'basketball_nba', group: 'Basketball', title: 'NBA', description: 'US Basketball' },
  { key: 'cricket_ipl', group: 'Cricket', title: 'IPL', description: 'Indian Premier League' },
  { key: 'americanfootball_nfl', group: 'American Football', title: 'NFL', description: 'US Football' },
  { key: 'baseball_mlb', group: 'Baseball', title: 'MLB', description: 'US Baseball' }
];

const MOCK_ODDS = [
  {
    id: 'm1',
    sport_key: 'soccer_epl',
    sport_title: 'Premier League',
    commence_time: new Date(Date.now() + 3600000 * 4).toISOString(),
    home_team: 'Arsenal',
    away_team: 'Chelsea',
    bookmakers: [
      {
        key: 'draftkings',
        title: 'DraftKings',
        markets: [
          {
            key: 'h2h',
            outcomes: [
              { name: 'Arsenal', price: 1.85 },
              { name: 'Draw', price: 3.60 },
              { name: 'Chelsea', price: 4.20 }
            ]
          }
        ]
      },
      {
        key: 'fanduel',
        title: 'FanDuel',
        markets: [
          {
            key: 'h2h',
            outcomes: [
              { name: 'Arsenal', price: 1.88 },
              { name: 'Draw', price: 3.50 },
              { name: 'Chelsea', price: 4.10 }
            ]
          }
        ]
      }
    ]
  },
  {
    id: 'm2',
    sport_key: 'basketball_nba',
    sport_title: 'NBA',
    commence_time: new Date(Date.now() + 3600000 * 8).toISOString(),
    home_team: 'Los Angeles Lakers',
    away_team: 'Golden State Warriors',
    bookmakers: [
      {
        key: 'betmgm',
        title: 'BetMGM',
        markets: [
          {
            key: 'h2h',
            outcomes: [
              { name: 'Los Angeles Lakers', price: 2.10 },
              { name: 'Golden State Warriors', price: 1.75 }
            ]
          }
        ]
      }
    ]
  },
  {
    id: 'm3',
    sport_key: 'cricket_ipl',
    sport_title: 'IPL',
    commence_time: new Date(Date.now() + 3600000 * 12).toISOString(),
    home_team: 'Mumbai Indians',
    away_team: 'Chennai Super Kings',
    bookmakers: [
      {
        key: 'bet365',
        title: 'Bet365',
        markets: [
          {
            key: 'h2h',
            outcomes: [
              { name: 'Mumbai Indians', price: 1.90 },
              { name: 'Chennai Super Kings', price: 1.90 }
            ]
          }
        ]
      }
    ]
  }
];

// Odds format helper utilities
const convertOdds = (decimal, format) => {
  if (!decimal || isNaN(decimal)) return '-';
  if (format === 'decimal') return decimal.toFixed(2);
  if (format === 'american') {
    if (decimal >= 2.0) {
      const val = Math.round((decimal - 1) * 100);
      return `+${val}`;
    } else {
      const val = Math.round(-100 / (decimal - 1));
      return `${val}`;
    }
  }
  if (format === 'fractional') {
    const dec = decimal - 1;
    // Simple fraction approximation for display
    const gcd = (a, b) => (b < 0.00001 ? a : gcd(b, Math.floor(a % b)));
    const len = 1000;
    const num = Math.round(dec * len);
    const divisor = gcd(num, len);
    const top = num / divisor;
    const bottom = len / divisor;
    return `${Math.round(top)}/${Math.round(bottom)}`;
  }
  return decimal.toFixed(2);
};

export default function App() {
  // State management
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('THE_ODDS_API_KEY') || '');
  const [useMock, setUseMock] = useState(!apiKey);
  const [sports, setSports] = useState(MOCK_SPORTS);
  const [selectedSport, setSelectedSport] = useState('all');
  const [oddsData, setOddsData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [oddsFormat, setOddsFormat] = useState('decimal'); // 'decimal' | 'american' | 'fractional'
  const [betSlip, setBetSlip] = useState([]);
  const [stake, setStake] = useState(10);
  const [betPlaced, setBetPlaced] = useState(false);
  const [regions, setRegions] = useState('us'); // 'us' | 'uk' | 'eu' | 'au'
  const [quotaRemaining, setQuotaRemaining] = useState(null);

  // Save API key
  const handleSaveApiKey = (key) => {
    setApiKey(key);
    localStorage.setItem('THE_ODDS_API_KEY', key);
    if (key.trim()) {
      setUseMock(false);
    } else {
      setUseMock(true);
    }
  };

  // Fetch available sports from The Odds API or set Mock
  const fetchSports = async () => {
    if (useMock || !apiKey) {
      setSports(MOCK_SPORTS);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`https://api.the-odds-api.com/v4/sports/?apiKey=${apiKey}`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}: ${res.statusText}`);
      
      const data = await res.json();
      const remaining = res.headers.get('x-requests-remaining');
      if (remaining) setQuotaRemaining(remaining);
      
      if (Array.isArray(data) && data.length > 0) {
        setSports(data);
      } else {
        setSports(MOCK_SPORTS);
      }
    } catch (err) {
      console.error('Error fetching sports:', err);
      setError('Failed to fetch live sports. Check API Key or falling back to mock.');
      setSports(MOCK_SPORTS);
    } finally {
      setLoading(false);
    }
  };

  // Fetch odds for selected sport
  const fetchOdds = async (sportKey = selectedSport) => {
    if (useMock || !apiKey) {
      if (sportKey === 'all') {
        setOddsData(MOCK_ODDS);
      } else {
        setOddsData(MOCK_ODDS.filter(o => o.sport_key === sportKey));
      }
      return;
    }

    const keyToFetch = sportKey === 'all' ? 'upcoming' : sportKey;

    try {
      setLoading(true);
      setError(null);
      const url = `https://api.the-odds-api.com/v4/sports/${keyToFetch}/odds/?apiKey=${apiKey}&regions=${regions}&markets=h2h`;
      
      const res = await fetch(url);
      if (!res.ok) throw new Error(`API Error ${res.status}: ${res.statusText}`);

      const data = await res.json();
      const remaining = res.headers.get('x-requests-remaining');
      if (remaining) setQuotaRemaining(remaining);

      setOddsData(data);
    } catch (err) {
      console.error('Error fetching odds:', err);
      setError(err.message || 'Error loading odds data.');
      setOddsData(MOCK_ODDS);
    } finally {
      setLoading(false);
    }
  };

  // Trigger data fetch on key mount / sport select
  useEffect(() => {
    fetchSports();
  }, [apiKey, useMock]);

  useEffect(() => {
    fetchOdds(selectedSport);
  }, [selectedSport, apiKey, useMock, regions]);

  // Add selection to Bet Slip
  const toggleBetSelection = (match, outcome, bookmakerTitle) => {
    const existingIndex = betSlip.findIndex(
      item => item.matchId === match.id && item.outcomeName === outcome.name
    );

    if (existingIndex > -1) {
      // Remove if exists
      setBetSlip(betSlip.filter((_, idx) => idx !== existingIndex));
    } else {
      // Add selection (replacing any existing bet for the same match to avoid conflict)
      const filtered = betSlip.filter(item => item.matchId !== match.id);
      const newBet = {
        id: `${match.id}-${outcome.name}`,
        matchId: match.id,
        matchTitle: `${match.home_team} vs ${match.away_team}`,
        outcomeName: outcome.name,
        price: outcome.price,
        bookmaker: bookmakerTitle,
        sport: match.sport_title
      };
      setBetSlip([...filtered, newBet]);
    }
  };

  // Total odds calculation for Accumulator/Parlay
  const totalOdds = useMemo(() => {
    if (betSlip.length === 0) return 1.0;
    return betSlip.reduce((acc, item) => acc * item.price, 1.0);
  }, [betSlip]);

  const potentialPayout = (stake * totalOdds).toFixed(2);

  // Filtered Matches based on search and selected sport
  const filteredMatches = useMemo(() => {
    return oddsData.filter(match => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        match.home_team?.toLowerCase().includes(searchLower) ||
        match.away_team?.toLowerCase().includes(searchLower) ||
        match.sport_title?.toLowerCase().includes(searchLower);
      
      const matchesSport = selectedSport === 'all' || match.sport_key === selectedSport;

      return matchesSearch && matchesSport;
    });
  }, [oddsData, searchTerm, selectedSport]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col antialiased">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 lg:px-8 py-3">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Logo & Title */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                <Trophy className="w-6 h-6" />
              </div>
              <div>
                <h1 className="font-bold text-lg leading-tight tracking-tight text-white flex items-center gap-2">
                  ODDS HUB <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30 font-semibold">LIVE</span>
                </h1>
                <p className="text-xs text-slate-400">Real-Time Sports Betting Aggregator</p>
              </div>
            </div>

            {/* Quick Status Pill */}
            <div className="flex items-center gap-2 md:hidden">
              <span className={`w-2 h-2 rounded-full ${useMock ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}`}></span>
              <span className="text-xs text-slate-400">{useMock ? 'Demo Mode' : 'Live API'}</span>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search teams, leagues, or sports..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-800/80 text-sm text-slate-200 placeholder-slate-400 pl-9 pr-4 py-2 rounded-xl border border-slate-700/60 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
              >
                Clear
              </button>
            )}
          </div>

          {/* Odds Format Selector & API Modal Trigger */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            {/* Format Toggle */}
            <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700/60 text-xs font-medium">
              {['decimal', 'american', 'fractional'].map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => setOddsFormat(fmt)}
                  className={`px-2.5 py-1 rounded-lg capitalize transition ${
                    oddsFormat === fmt 
                      ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm' 
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {fmt}
                </button>
              ))}
            </div>

            {/* Region Selector */}
            <select
              value={regions}
              onChange={(e) => setRegions(e.target.value)}
              className="bg-slate-800 text-xs text-slate-300 border border-slate-700/60 rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-emerald-500"
            >
              <option value="us">US Bookies</option>
              <option value="uk">UK Bookies</option>
              <option value="eu">EU Bookies</option>
              <option value="au">AU Bookies</option>
            </select>
          </div>
        </div>
      </header>

      {/* API Key Bar / Status banner */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 lg:px-8 py-2 text-xs">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Key className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-400">The Odds API Key:</span>
            <input 
              type="password" 
              placeholder="Paste your API key here..."
              value={apiKey}
              onChange={(e) => handleSaveApiKey(e.target.value)}
              className="bg-slate-950 text-slate-200 px-2 py-1 rounded border border-slate-700/60 w-48 focus:outline-none focus:border-emerald-500 text-xs"
            />
            {useMock ? (
              <span className="text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                Using Mock Data
              </span>
            ) : (
              <span className="text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded border border-emerald-400/20 flex items-center gap-1">
                Live Connection
              </span>
            )}
            {quotaRemaining !== null && !useMock && (
              <span className="text-slate-400 ml-2">Requests left: <strong className="text-slate-200">{quotaRemaining}</strong></span>
            )}
          </div>

          <div className="flex items-center gap-3 text-slate-400">
            <a 
              href="https://the-odds-api.com/" 
              target="_blank" 
              rel="noreferrer" 
              className="hover:text-emerald-400 flex items-center gap-1 underline transition"
            >
              Get Free Key <ExternalLink className="w-3 h-3" />
            </a>
            <button 
              onClick={() => fetchOdds(selectedSport)}
              className="flex items-center gap-1 text-slate-300 hover:text-white bg-slate-800 px-2.5 py-1 rounded border border-slate-700 transition"
              disabled={loading}
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="max-w-7xl mx-auto w-full px-4 lg:px-8 py-6 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Sidebar: Sports Filter */}
        <aside className="lg:col-span-3 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <Filter className="w-4 h-4 text-emerald-400" /> Sports & Leagues
            </h2>
            <div className="space-y-1">
              <button
                onClick={() => setSelectedSport('all')}
                className={`w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition flex items-center justify-between ${
                  selectedSport === 'all'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                }`}
              >
                <span>🔥 All Featured Matches</span>
              </button>

              {sports.map((sport) => (
                <button
                  key={sport.key}
                  onClick={() => setSelectedSport(sport.key)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition flex items-center justify-between ${
                    selectedSport === sport.key
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                  }`}
                >
                  <span className="truncate">{sport.title || sport.details}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Center Main Content: Match Cards & Odds Display */}
        <main className="lg:col-span-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-400" /> Upcoming Matches & Odds
            </h2>
            <span className="text-xs text-slate-400">
              {filteredMatches.length} match{filteredMatches.length !== 1 ? 'es' : ''} available
            </span>
          </div>

          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center gap-3 text-rose-400 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-3 bg-slate-900/50 rounded-2xl border border-slate-800">
              <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
              <p className="text-sm text-slate-400">Fetching live odds from market...</p>
            </div>
          ) : filteredMatches.length === 0 ? (
            <div className="text-center py-16 bg-slate-900/50 rounded-2xl border border-slate-800">
              <Trophy className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-300 font-medium">No matches found</p>
              <p className="text-xs text-slate-500 mt-1">Try selecting a different sport or clearing your search filter.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredMatches.map((match) => {
                const bookmaker = match.bookmakers && match.bookmakers[0];
                const h2hMarket = bookmaker?.markets?.find(m => m.key === 'h2h');

                return (
                  <div 
                    key={match.id} 
                    className="bg-slate-900 border border-slate-800/80 rounded-2xl p-4 hover:border-slate-700 transition shadow-lg"
                  >
                    {/* Header Info */}
                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5 mb-3 text-xs">
                      <span className="text-emerald-400 font-semibold bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                        {match.sport_title || 'Sports Market'}
                      </span>
                      <span className="text-slate-400">
                        {new Date(match.commence_time).toLocaleString([], {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>

                    {/* Matchup Teams */}
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-slate-700"></div>
                        <span className="font-medium text-slate-100">{match.home_team}</span>
                      </div>
                      <div className="flex items-center gap-2 justify-end">
                        <span className="font-medium text-slate-100">{match.away_team}</span>
                        <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                      </div>
                    </div>

                    {/* Bookmaker Odds Selector */}
                    {h2hMarket ? (
                      <div>
                        <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                          <span>Market: Head to Head (H2H)</span>
                          <span className="text-slate-500">Source: {bookmaker.title}</span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {h2hMarket.outcomes.map((outcome) => {
                            const isSelected = betSlip.some(
                              item => item.matchId === match.id && item.outcomeName === outcome.name
                            );

                            return (
                              <button
                                key={outcome.name}
                                onClick={() => toggleBetSelection(match, outcome, bookmaker.title)}
                                className={`p-2.5 rounded-xl border text-center transition flex flex-col items-center justify-center ${
                                  isSelected
                                    ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold shadow-md shadow-emerald-500/20 scale-[1.02]'
                                    : 'bg-slate-800/70 border-slate-700/60 hover:bg-slate-800 hover:border-slate-600 text-slate-200'
                                }`}
                              >
                                <span className="text-xs truncate w-full opacity-90">{outcome.name}</span>
                                <span className="text-sm font-bold mt-0.5">
                                  {convertOdds(outcome.price, oddsFormat)}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 text-center py-2 bg-slate-800/30 rounded-xl">
                        Odds currently unavailable for this match
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </main>

        {/* Right Sidebar: Bet Slip */}
        <aside className="lg:col-span-3 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sticky top-20 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-emerald-400" /> Bet Slip
              </h2>
              {betSlip.length > 0 && (
                <button 
                  onClick={() => setBetSlip([])}
                  className="text-xs text-slate-500 hover:text-rose-400 flex items-center gap-1 transition"
                >
                  <Trash2 className="w-3 h-3" /> Clear
                </button>
              )}
            </div>

            {betPlaced ? (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto animate-bounce" />
                <p className="text-emerald-400 font-semibold text-sm">Bet Placed Successfully!</p>
                <p className="text-xs text-slate-400">Good luck! Simulated bet logged.</p>
                <button 
                  onClick={() => { setBetPlaced(false); setBetSlip([]); }}
                  className="mt-2 w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 rounded-lg transition"
                >
                  Create New Slip
                </button>
              </div>
            ) : betSlip.length === 0 ? (
              <div className="text-center py-10 space-y-2">
                <ShoppingBag className="w-8 h-8 text-slate-700 mx-auto" />
                <p className="text-xs text-slate-400">Your slip is empty.</p>
                <p className="text-[11px] text-slate-500">Click on any odds market to add selections.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Items List */}
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {betSlip.map((item) => (
                    <div key={item.id} className="bg-slate-800/60 border border-slate-700/50 p-2.5 rounded-xl relative group">
                      <button 
                        onClick={() => toggleBetSelection({ id: item.matchId }, { name: item.outcomeName }, item.bookmaker)}
                        className="absolute top-2 right-2 text-slate-500 hover:text-rose-400"
                      >
                        ×
                      </button>
                      <p className="text-xs text-slate-400 truncate pr-4">{item.matchTitle}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs font-semibold text-emerald-400">{item.outcomeName}</span>
                        <span className="text-xs font-bold bg-slate-700 px-2 py-0.5 rounded text-slate-100">
                          {convertOdds(item.price, oddsFormat)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Calculation summary */}
                <div className="border-t border-slate-800 pt-3 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Selections ({betSlip.length}):</span>
                    <span className="text-slate-200 font-medium">
                      {betSlip.length > 1 ? 'Accumulator / Parlay' : 'Single'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Total Odds:</span>
                    <span className="text-emerald-400 font-bold text-sm">
                      {convertOdds(totalOdds, oddsFormat)}
                    </span>
                  </div>

                  {/* Stake input */}
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 block">Stake Amount ($):</label>
                    <div className="relative">
                      <DollarSign className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        type="number" 
                        min="1" 
                        value={stake} 
                        onChange={(e) => setStake(Math.max(1, Number(e.target.value)))}
                        className="w-full bg-slate-950 text-sm text-slate-100 pl-8 pr-3 py-1.5 rounded-xl border border-slate-700/60 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Payout */}
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 flex items-center justify-between">
                    <span className="text-xs text-slate-400">Est. Payout:</span>
                    <span className="text-base font-extrabold text-emerald-400">${potentialPayout}</span>
                  </div>

                  {/* Place Bet Action */}
                  <button 
                    onClick={() => setBetPlaced(true)}
                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2.5 rounded-xl transition shadow-lg shadow-emerald-500/20 active:scale-95 text-xs uppercase tracking-wider"
                  >
                    Place Bet (${stake})
                  </button>
                </div>
              </div>
            )}
          </div>
        </aside>

      </div>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 py-4 px-4 text-center text-xs text-slate-500">
        <p>Data provided by <strong>The Odds API</strong>. Built for educational and analytical purposes.</p>
      </footer>
    </div>
  );
}
