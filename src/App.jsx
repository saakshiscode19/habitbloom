import React, {
  useEffect,
  useMemo,
  useState,
  useRef,
} from "react";
import html2canvas from "html2canvas";
import { supabase } from "./supabaseClient";

/* ---------- Helpers ---------- */

function formatDate(date) {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
}

// Generate all days from Jan 1 of current year to today
function getDaysFromStartOfYear() {
  const days = [];
  const today = new Date();
  const start = new Date(today.getFullYear(), 0, 1); // Jan 1

  const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    const copy = new Date(d);

    const jsDay = copy.getDay(); // 0..6 (Sun..Sat)
    const weekdayRow = (jsDay + 6) % 7; // 0..6 (Mon..Sun)

    days.push({
      date: formatDate(copy),
      label: copy.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
      }),
      weekdayRow,
      weekdayLabel: weekdayLabels[weekdayRow],
      dayOfMonth: copy.getDate(),
      monthIndex: copy.getMonth(),
      monthShort: copy.toLocaleDateString(undefined, { month: "short" }),
    });
  }
  return days;
}

function getColorClass(ratio) {
  if (ratio === 0) return "bg-slate-100";
  if (ratio < 0.25) return "bg-emerald-50";
  if (ratio < 0.5) return "bg-emerald-100";
  if (ratio < 0.75) return "bg-emerald-200";
  return "bg-emerald-300";
}

/* ---------- Landing page ---------- */

function LandingPage({ onGetStarted, onLogin }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-emerald-50 text-slate-900">
      <header className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-2xl bg-emerald-200 flex items-center justify-center text-sm font-bold">
            🌱
          </div>
          <span className="font-semibold tracking-tight">HabitBloom</span>
        </div>
        <nav className="flex items-center gap-4 text-sm">
          <button
            onClick={onLogin}
            className="px-3 py-1.5 rounded-full hover:bg-slate-100 transition"
          >
            Log in
          </button>
          <button
            onClick={onGetStarted}
            className="px-4 py-1.5 rounded-full bg-emerald-500 text-white text-sm font-medium shadow-sm hover:bg-emerald-600 transition"
          >
            Start free
          </button>
        </nav>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-14 grid md:grid-cols-2 gap-12 items-center">
        <div className="space-y-6">
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-slate-900">
            Turn tiny habits into{" "}
            <span className="bg-emerald-100 px-2 rounded-xl">big wins.</span>
          </h1>
          <p className="text-slate-600 text-base md:text-lg">
          Build better habits one tiny step at a time.
          Check in daily and watch consistency turn into progress.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={onGetStarted}
              className="px-5 py-2.5 rounded-full bg-emerald-500 text-white font-medium shadow-md hover:shadow-lg hover:bg-emerald-600 transition"
            >
              Get started in 30 seconds
            </button>
          </div>
        </div>

        <div className="relative">
          <div className="rounded-3xl border border-slate-100 bg-white shadow-lg shadow-emerald-50 p-5">
            <div className="flex justify-between items-center mb-4">
              <div>
                <p className="text-xs text-slate-400 uppercase font-medium">
                  Preview
                </p>
                <p className="text-sm font-semibold text-slate-800">
                  Habit heatmaps
                </p>
              </div>
              <span className="text-xs px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 font-medium">
                Streaks on autopilot 🔥
              </span>
            </div>
            <div className="grid grid-cols-8 gap-1 mb-4">
              {Array.from({ length: 32 }).map((_, idx) => (
                <div
                  key={idx}
                  className={`w-4 h-4 rounded-md ${
                    idx % 7 === 0
                      ? "bg-emerald-300"
                      : idx % 5 === 0
                      ? "bg-emerald-200"
                      : idx % 3 === 0
                      ? "bg-emerald-100"
                      : "bg-slate-100"
                  }`}
                />
              ))}
            </div>
            <p className="text-xs text-slate-500">
              Check off a habit once a day and watch the grid fill up.
            </p>
          </div>
          <div className="absolute -bottom-6 -left-4 text-xs px-3 py-1.5 rounded-2xl bg-white border border-emerald-100 shadow-sm text-emerald-700">
            “Filling the grid is lowkey addictive.” ✨
          </div>
        </div>
      </main>
    </div>
  );
}

/* ---------- Dashboard (Supabase-backed) ---------- */

function Dashboard({ user, onLogout }) {
  const weekdayOrder = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const displayName = user?.user_metadata?.username || user?.email;

  const [theme, setTheme] = useState("light"); // "light" | "dark"

  const days = useMemo(() => getDaysFromStartOfYear(), []);
  const [selectedDate, setSelectedDate] = useState(
    days[days.length - 1].date
  );

  const [habits, setHabits] = useState([]); // from Supabase
  const [entries, setEntries] = useState([]); // from Supabase
  const [newHabit, setNewHabit] = useState({ name: "" });
  const [loading, setLoading] = useState(true);

  // drag-to-edit
  const [isDragging, setIsDragging] = useState(false);
  const [dragValue, setDragValue] = useState(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState("");

  const heatmapRef = useRef(null);

  // Group days into months
  const months = useMemo(() => {
    const groups = [];
    days.forEach((day) => {
      const m = day.monthIndex;
      if (!groups[m]) {
        groups[m] = {
          monthIndex: m,
          monthShort: day.monthShort,
          days: [],
        };
      }
      groups[m].days.push(day);
    });
    return groups.filter(Boolean);
  }, [days]);

  /* ---------- Theme classes ---------- */

  const pageClass =
    theme === "light"
      ? "bg-slate-50 text-slate-900"
      : "bg-slate-950 text-slate-50";

  const headerClass =
    theme === "light"
      ? "bg-white border-slate-200"
      : "bg-slate-900 border-slate-800";

  const cardClass =
    theme === "light"
      ? "bg-white border-slate-100"
      : "bg-slate-900 border-slate-800";

  const subtleTextClass =
    theme === "light" ? "text-slate-500" : "text-slate-400";

  const borderSoftClass =
    theme === "light" ? "border-slate-100" : "border-slate-700";

  /* ---------- Load habits + entries from Supabase ---------- */

  useEffect(() => {
    async function fetchData() {
      if (!user) return;
      setLoading(true);

      const { data: habitsData, error: habitsError } = await supabase
        .from("habits")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (habitsError) {
        console.error("Error fetching habits:", habitsError);
        setLoading(false);
        return;
      }

      const { data: entriesData, error: entriesError } = await supabase
        .from("habit_entries")
        .select("*")
        .eq("user_id", user.id);

      if (entriesError) {
        console.error("Error fetching entries:", entriesError);
        setHabits(habitsData || []);
        setLoading(false);
        return;
      }

      setHabits(habitsData || []);
      setEntries(entriesData || []);
      setLoading(false);
    }

    fetchData();
  }, [user]);

  /* ---------- Global mouseup to end drag ---------- */

  useEffect(() => {
    function handleMouseUp() {
      setIsDragging(false);
      setDragValue(null);
    }
    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, []);

  /* ---------- Helpers ---------- */

  function getEntry(habitId, date) {
    return entries.find(
      (e) => e.habit_id === habitId && e.date === date
    );
  }

  function getHabitDayRatio(habit, date) {
    const entry = getEntry(habit.id, date);
    if (!entry) return 0;
    return entry.value ? 1 : 0;
  }

  function getHabitStreak(habit) {
    let count = 0;
    for (let i = days.length - 1; i >= 0; i--) {
      const ratio = getHabitDayRatio(habit, days[i].date);
      if (ratio > 0) count++;
      else break;
    }
    return count;
  }

  function getHabitLongestStreak(habit) {
    let max = 0;
    let current = 0;
    for (const day of days) {
      const ratio = getHabitDayRatio(habit, day.date);
      if (ratio > 0) {
        current++;
        if (current > max) max = current;
      } else {
        current = 0;
      }
    }
    return max;
  }

  const totalHabits = habits.length;
  const selectedCompleted = habits.reduce((acc, habit) => {
    const ratio = getHabitDayRatio(habit, selectedDate);
    return acc + (ratio > 0 ? 1 : 0);
  }, 0);
  const selectedRatio =
    totalHabits > 0 ? selectedCompleted / totalHabits : 0;

  const totalPossibleCompletions = days.length * Math.max(totalHabits, 1);
  const totalCompletions = entries.filter((e) => e.value).length;
  const overallCompletionRate =
    totalPossibleCompletions > 0
      ? Math.round((totalCompletions / totalPossibleCompletions) * 100)
      : 0;

  const longestStreakGlobal = habits.reduce((max, h) => {
    const s = getHabitLongestStreak(h);
    return s > max ? s : max;
  }, 0);

  const bestHabit =
    habits.length > 0
      ? habits
          .map((h) => ({
            habit: h,
            streak: getHabitLongestStreak(h),
          }))
          .sort((a, b) => b.streak - a.streak)[0]
      : null;

  /* ---------- Mutations → Supabase ---------- */

  async function updateEntry(habitId, date, value) {
    if (!user) return;

    const { data, error } = await supabase
      .from("habit_entries")
      .upsert(
        {
          user_id: user.id,
          habit_id: habitId,
          date,
          value,
        },
        { onConflict: "user_id,habit_id,date" }
      )
      .select()
      .single();

    if (error) {
      console.error("Error updating entry:", error);
      return;
    }

    setEntries((prev) => {
      const idx = prev.findIndex(
        (e) => e.habit_id === habitId && e.date === date
      );
      if (idx !== -1) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], ...data };
        return copy;
      }
      return [...prev, data];
    });
  }

  async function handleCreateHabit(e) {
    e.preventDefault();
    if (!user) return;
    if (!newHabit.name.trim()) return;

    const { data, error } = await supabase
      .from("habits")
      .insert({
        user_id: user.id,
        name: newHabit.name.trim(),
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating habit:", error);
      return;
    }

    setHabits((prev) => [...prev, data]);
    setNewHabit({ name: "" });
  }

  async function handleDeleteHabit(id) {
    if (!user) return;

    const { error } = await supabase
      .from("habits")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error deleting habit:", error);
      return;
    }

    setHabits((prev) => prev.filter((h) => h.id !== id));
    setEntries((prev) => prev.filter((e) => e.habit_id !== id));
  }

  /* ---------- Change password ---------- */

  async function handleChangePassword(e) {
    e.preventDefault();
    setPasswordMsg("");

    if (!newPassword || newPassword.length < 6) {
      setPasswordMsg("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg("Passwords do not match.");
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;
      setPasswordMsg("Password updated successfully ✅");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      console.error(err);
      setPasswordMsg(err.message || "Failed to update password.");
    }
  }

  /* ---------- Share text ---------- */

  function handleShareText() {
    const dateLabel = new Date(selectedDate).toLocaleDateString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    const text = `My HabitBloom progress on ${dateLabel}: ${selectedCompleted}/${totalHabits} habits done 🌱`;

    if (navigator.share) {
      navigator
        .share({
          title: "My HabitBloom progress",
          text,
        })
        .catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        alert("Progress text copied to clipboard ✨");
      });
    } else {
      alert(text);
    }
  }

  /* ---------- Share image (heatmap) ---------- */

  async function handleShareImage() {
    if (!heatmapRef.current) return;

    try {
      const canvas = await html2canvas(heatmapRef.current, {
        backgroundColor: theme === "light" ? "#f8fafc" : "#020617",
        scale: 2,
      });
      const dataUrl = canvas.toDataURL("image/png");

      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = "habit-heatmap.png";
      link.click();
    } catch (err) {
      console.error("Error creating image:", err);
      alert("Could not create image. Check console for details.");
    }
  }

  /* ---------- UI ---------- */

  return (
    <div className={`min-h-screen ${pageClass}`}>
      <header className={`border-b ${headerClass}`}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-2xl bg-emerald-500/80 flex items-center justify-center text-xs font-bold">
              🌱
            </div>
            <span className="font-semibold text-sm tracking-tight">
              HabitBloom
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1">
              <span className={subtleTextClass}>Theme</span>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className="border border-slate-400/40 rounded-full px-2 py-1 text-[11px] bg-transparent"
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>
            <span className={subtleTextClass}>{displayName}</span>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                onLogout();
              }}
              className="px-3 py-1 rounded-full border border-slate-400/60 text-sm hover:bg-slate-100/10 transition"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 grid lg:grid-cols-[2fr,1.6fr] gap-8">
        {/* LEFT: heatmaps per habit */}
        <section
          ref={heatmapRef}
          className={`${cardClass} rounded-3xl shadow-sm p-5`}
        >
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-sm font-semibold">
                Habit streaks
              </h2>
              <p className={`text-xs ${subtleTextClass}`}>
                Each row is one habit. Months are separated into blocks.
              </p>
            </div>
          </div>

          {loading && (
            <p className={`text-xs ${subtleTextClass} mb-3`}>
              Loading your habits…
            </p>
          )}

          <div className="space-y-4 max-h-[70vh] overflow-auto pr-1">
            {habits.map((habit) => {
              const habitStreak = getHabitStreak(habit);
              const longest = getHabitLongestStreak(habit);
              return (
                <div
                  key={habit.id}
                  className={`border ${borderSoftClass} rounded-2xl px-3 py-3 hover:border-emerald-300/80 hover:bg-emerald-50/10 transition`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">
                        {habit.name}
                      </span>
                      <span className={`text-[11px] ${subtleTextClass}`}>
                        Current streak: {habitStreak} • Best streak: {longest}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeleteHabit(habit.id)}
                      className="text-[10px] text-slate-400 hover:text-rose-500"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="flex gap-2 items-start">
                    {/* Left: labels */}
                    <div className={`flex flex-col text-[9px] ${subtleTextClass}`}>
                      <div className="h-4 mb-1" />
                      <div className="flex flex-col gap-1">
                        {weekdayOrder.map((d) => (
                          <span key={d} className="h-4 flex items-center">
                            {d}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Months */}
                    <div className="flex overflow-x-auto pr-4">
                      {months.map((month) => (
                        <div
                          key={month.monthIndex}
                          className="flex flex-col mr-4 last:mr-8"
                        >
                          <div
                            className={`h-4 text-[9px] ${subtleTextClass} flex items-center justify-center mb-1`}
                          >
                            {month.monthShort}
                          </div>

                          <div className="grid grid-flow-col auto-cols-max gap-1">
                            {month.days.map((day) => {
                              const ratio = getHabitDayRatio(
                                habit,
                                day.date
                              );
                              const isSelected =
                                selectedDate === day.date;
                              const gridRowStart = day.weekdayRow + 1;

                              return (
                                <button
                                  key={day.date}
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    setSelectedDate(day.date);
                                    const current = getEntry(
                                      habit.id,
                                      day.date
                                    );
                                    const currentVal = current
                                      ? !!current.value
                                      : false;
                                    const nextVal = !currentVal;
                                    setIsDragging(true);
                                    setDragValue(nextVal);
                                    updateEntry(
                                      habit.id,
                                      day.date,
                                      nextVal
                                    );
                                  }}
                                  onMouseEnter={() => {
                                    if (!isDragging || dragValue === null)
                                      return;
                                    updateEntry(
                                      habit.id,
                                      day.date,
                                      dragValue
                                    );
                                  }}
                                  onClick={(e) => {
                                    e.preventDefault(); // prevent double toggle
                                  }}
                                  className={`w-3.5 h-3.5 rounded-md ${getColorClass(
                                    ratio
                                  )} border ${
                                    isSelected
                                      ? "border-emerald-500"
                                      : "border-slate-200"
                                  }`}
                                  title={`${day.label} • ${
                                    ratio > 0 ? "Done" : "Not done"
                                  }`}
                                  style={{ gridRowStart }}
                                />
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}

            {!loading && habits.length === 0 && (
              <p className={`text-xs ${subtleTextClass}`}>
                No habits yet. Add one on the right to start your streaks ✨
              </p>
            )}
          </div>
        </section>

        {/* RIGHT: editor + creator + analytics + change password */}
        <section className="flex flex-col gap-4">
          {/* Editor */}
          <div className={`${cardClass} rounded-3xl shadow-sm p-5 flex flex-col`}>
            <div className="flex justify-between items-center mb-3">
              <div>
                <h2 className="text-sm font-semibold">
                  Habits on this day
                </h2>
                <p className={`text-[11px] ${subtleTextClass}`}>
                  Drag across the grid to mark many days at once.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleShareText}
                  className="text-[11px] px-3 py-1.5 rounded-full border border-slate-300 hover:bg-slate-100/10"
                >
                  Share text
                </button>
                <button
                  onClick={handleShareImage}
                  className="text-[11px] px-3 py-1.5 rounded-full bg-emerald-500 text-white hover:bg-emerald-600"
                >
                  Download image
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between mb-3">
              <span className={`text-xs ${subtleTextClass}`}>
                {new Date(selectedDate).toLocaleDateString(undefined, {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })}
              </span>
              <span className={`text-[11px] ${subtleTextClass}`}>
                {selectedCompleted}/{totalHabits} habits done
              </span>
            </div>

            <div className="w-full h-2 rounded-full bg-slate-100 mb-4 overflow-hidden">
              <div
                className="h-full bg-emerald-400 transition-all duration-300"
                style={{ width: `${selectedRatio * 100}%` }}
              />
            </div>

            <div className="space-y-4">
              {habits.map((habit) => {
                const entry = getEntry(habit.id, selectedDate);
                const value = entry ? !!entry.value : false;

                return (
                  <div
                    key={habit.id}
                    className={`border ${borderSoftClass} rounded-2xl px-3 py-3 flex flex-col gap-2 hover:border-emerald-300/80 hover:bg-emerald-50/10 transition`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">
                        {habit.name}
                      </span>
                      <button
                        onClick={() =>
                          updateEntry(habit.id, selectedDate, !value)
                        }
                        className={`text-[11px] px-2 py-1 rounded-full border ${
                          value
                            ? "bg-emerald-500 text-white border-emerald-500"
                            : "bg-transparent text-slate-500 border-slate-300"
                        } transition`}
                      >
                        {value ? "Done 🎉" : "Mark done"}
                      </button>
                    </div>
                  </div>
                );
              })}

              {!loading && habits.length === 0 && (
                <p className={`text-xs ${subtleTextClass}`}>
                  Add a habit below to start tracking.
                </p>
              )}
            </div>
          </div>

          {/* Habit creator */}
          <div className={`${cardClass} rounded-3xl shadow-sm p-5`}>
            <h2 className="text-sm font-semibold mb-3">
              Create a new habit
            </h2>
            <form
              onSubmit={handleCreateHabit}
              className="flex flex-col gap-3 text-xs"
            >
              <div className="flex flex-col gap-1">
                <label className={subtleTextClass}>Habit name</label>
                <input
                  type="text"
                  value={newHabit.name}
                  onChange={(e) =>
                    setNewHabit({ name: e.target.value })
                  }
                  className="border border-slate-300 rounded-xl px-3 py-2 text-xs bg-transparent focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400"
                  placeholder="e.g. Run, Read, Gym, Meditate..."
                />
              </div>

              <button
                type="submit"
                className="mt-1 self-start px-4 py-2 rounded-xl bg-emerald-500 text-white text-xs font-medium hover:bg-emerald-600 transition"
              >
                Add habit
              </button>
            </form>
          </div>

          {/* Analytics */}
          <div className={`${cardClass} rounded-3xl shadow-sm p-5 text-xs`}>
            <h2 className="text-sm font-semibold mb-3">
              Analytics
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div className={`border ${borderSoftClass} rounded-xl px-3 py-2`}>
                <p className={`text-[11px] ${subtleTextClass} mb-1`}>
                  Overall completion
                </p>
                <p className="text-lg font-semibold">
                  {overallCompletionRate}%
                </p>
              </div>
              <div className={`border ${borderSoftClass} rounded-xl px-3 py-2`}>
                <p className={`text-[11px] ${subtleTextClass} mb-1`}>
                  Longest streak (any habit)
                </p>
                <p className="text-lg font-semibold">
                  {longestStreakGlobal} days
                </p>
              </div>
              <div
                className={`border ${borderSoftClass} rounded-xl px-3 py-2 col-span-2`}
              >
                <p className={`text-[11px] ${subtleTextClass} mb-1`}>
                  Strongest habit
                </p>
                {bestHabit ? (
                  <p className="text-sm font-semibold">
                    {bestHabit.habit.name} — best streak {bestHabit.streak} days
                  </p>
                ) : (
                  <p className={`text-[11px] ${subtleTextClass}`}>
                    Add a habit to see stats.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Change password */}
          <div className={`${cardClass} rounded-3xl shadow-sm p-5 text-xs`}>
            <h2 className="text-sm font-semibold mb-3">
              Change password
            </h2>
            <form
              onSubmit={handleChangePassword}
              className="flex flex-col gap-3"
            >
              <div className="flex flex-col gap-1">
                <label className={subtleTextClass}>New password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="border border-slate-300 rounded-xl px-3 py-2 text-xs bg-transparent focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400"
                  placeholder="••••••••"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className={subtleTextClass}>Confirm new password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="border border-slate-300 rounded-xl px-3 py-2 text-xs bg-transparent focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400"
                  placeholder="••••••••"
                />
              </div>
              {passwordMsg && (
                <p className="text-[11px] mt-1">{passwordMsg}</p>
              )}
              <button
                type="submit"
                className="self-start px-4 py-2 rounded-xl bg-emerald-500 text-white text-xs font-medium hover:bg-emerald-600 transition"
              >
                Update password
              </button>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}

/* ---------- Auth overlay (Supabase auth + username + forgot password) ---------- */

function AuthOverlay({ mode, onClose, onAuthSuccess }) {
  const title = mode === "login" ? "Log in" : "Sign up";
  const buttonText = mode === "login" ? "Log in" : "Create account";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg("");
    setInfoMsg("");
    setSubmitting(true);

    try {
      if (mode === "signup") {
        if (!username.trim()) {
          setErrorMsg("Please choose a username.");
          setSubmitting(false);
          return;
        }

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username: username.trim() },
          },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        onAuthSuccess(user);
      } else {
        setErrorMsg("Could not retrieve user after auth.");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleForgotPassword() {
    setErrorMsg("");
    setInfoMsg("");

    if (!email) {
      setErrorMsg("Enter your email first, then click 'Forgot password'.");
      return;
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (error) throw error;
      setInfoMsg("Password reset link sent to your email.");
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || "Failed to send reset email.");
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-3xl shadow-xl border border-slate-100 w-full max-w-sm p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-sm"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 mb-3">
          {mode === "signup" && (
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400"
                placeholder="yourusername"
                required
              />
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400"
              placeholder="you@example.com"
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">Password</label>
            <input
              type="password"
              value={password}
              minLength={6}
              onChange={(e) => setPassword(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400"
              placeholder="••••••••"
              required
            />
          </div>

          {errorMsg && (
            <p className="text-xs text-rose-500">{errorMsg}</p>
          )}
          {infoMsg && (
            <p className="text-xs text-emerald-600">{infoMsg}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full px-4 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 transition disabled:opacity-60"
          >
            {submitting ? "Please wait…" : buttonText}
          </button>
        </form>

        {mode === "login" && (
          <button
            type="button"
            onClick={handleForgotPassword}
            className="text-[11px] text-emerald-600 hover:underline"
          >
            Forgot password?
          </button>
        )}

        {mode === "signup" && (
          <p className="text-[11px] text-slate-400 mt-2">
          Email is sent to your EmailId. Confirm it and Login
          </p>
        )}
      </div>
    </div>
  );
}

/* ---------- Root App ---------- */

export default function App() {
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState(null); // "login" | "signup" | null
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    async function checkUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user || null);
      setCheckingSession(false);
    }
    checkUser();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500 text-sm">
        Loading…
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <LandingPage
          onGetStarted={() => setAuthMode("signup")}
          onLogin={() => setAuthMode("login")}
        />
        {authMode && (
          <AuthOverlay
            mode={authMode}
            onClose={() => setAuthMode(null)}
            onAuthSuccess={(u) => {
              setUser(u);
              setAuthMode(null);
            }}
          />
        )}
      </>
    );
  }

  return (
    <Dashboard
      user={user}
      onLogout={() => {
        setUser(null);
      }}
    />
  );
}
