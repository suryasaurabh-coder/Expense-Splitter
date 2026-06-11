import { useState, useEffect, useCallback } from "react";

const BASE = "/api/data";

const DEFAULT_PEOPLE = ["Surya","Sandeep","Uma","Naveen","Sreyas","Ayush","Armaan","Ani","Manyu","Jay","Lochan","Harshit","Pranit","Sid"];
const EXPENSE_TYPES = ["Excursion Tickets","Massage","Meals","Transport","Accommodation","Activities","Drinks","Shopping","Other"];

const C = {
  blue:"#1a56db", green:"#057a55", red:"#e02424", gray:"#6b7280",
  lb:"#eff6ff", lg:"#f0fdf4", lr:"#fef2f2", border:"#e5e7eb", bg:"#f9fafb"
};
const fmt = n => `$${Math.abs(n).toFixed(2)}`;

export default function App() {
  const [people, setPeople] = useState(DEFAULT_PEOPLE);
  const [expenses, setExpenses] = useState([]);
  const [tab, setTab] = useState("expenses");
  const [editIdx, setEditIdx] = useState(null);
  const [tmpName, setTmpName] = useState("");
  const [status, setStatus] = useState("loading");
  const [lastSaved, setLastSaved] = useState(null);

  // Load from JSONBin on mount
  useEffect(() => {
    fetch(BASE)
      .then(r => r.json())
      .then(data => {
        const rec = data.record;
        if (rec?.people) setPeople(rec.people);
        if (rec?.expenses) setExpenses(rec.expenses);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, []);

  // Save to JSONBin
  const save = useCallback((newPeople, newExpenses) => {
    setStatus("saving");
    fetch(BASE, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "X-Master-Key": API_KEY },
      body: JSON.stringify({ people: newPeople, expenses: newExpenses })
    })
      .then(() => { setStatus("saved"); setLastSaved(new Date()); })
      .catch(() => setStatus("error"));
  }, []);

  const updatePeople = (newPeople) => { setPeople(newPeople); save(newPeople, expenses); };
  const updateExpenses = (newExpenses) => { setExpenses(newExpenses); save(people, newExpenses); };

  const addExpense = () => {
    const e = { id: Date.now(), paidBy: people[0], type: "Excursion Tickets", amount: "", splitAmong: [...people], note: "" };
    updateExpenses([...expenses, e]);
  };

  const removeExpense = id => updateExpenses(expenses.filter(e => e.id !== id));
  const updateExpense = (id, field, val) => updateExpenses(expenses.map(e => e.id === id ? { ...e, [field]: val } : e));
  const togglePerson = (id, person) => {
    updateExpenses(expenses.map(e => {
      if (e.id !== id) return e;
      const has = e.splitAmong.includes(person);
      if (has && e.splitAmong.length === 1) return e;
      return { ...e, splitAmong: has ? e.splitAmong.filter(x => x !== person) : [...e.splitAmong, person] };
    }));
  };

  const saveName = idx => {
    if (!tmpName.trim()) return;
    const old = people[idx], nw = tmpName.trim();
    const newPeople = people.map((x, i) => i === idx ? nw : x);
    const newExpenses = expenses.map(e => ({
      ...e, paidBy: e.paidBy === old ? nw : e.paidBy,
      splitAmong: e.splitAmong.map(x => x === old ? nw : x)
    }));
    setPeople(newPeople); setExpenses(newExpenses);
    save(newPeople, newExpenses);
    setEditIdx(null);
  };

  const clearAll = () => {
    if (window.confirm("Clear all expenses? This cannot be undone.")) {
      updateExpenses([]);
    }
  };

  // Balances
  const balances = (() => {
    const net = Object.fromEntries(people.map(p => [p, 0]));
    expenses.forEach(e => {
      const amt = parseFloat(e.amount) || 0;
      if (!amt || !e.splitAmong.length) return;
      net[e.paidBy] += amt;
      e.splitAmong.forEach(p => net[p] -= amt / e.splitAmong.length);
    });
    return net;
  })();

  const settlements = (() => {
    const bal = { ...balances }, txns = [], eps = 0.01;
    for (let i = 0; i < 200; i++) {
      const cr = Object.entries(bal).filter(([,v]) => v > eps).sort((a,b) => b[1]-a[1]);
      const db = Object.entries(bal).filter(([,v]) => v < -eps).sort((a,b) => a[1]-b[1]);
      if (!cr.length || !db.length) break;
      const amt = Math.min(cr[0][1], -db[0][1]);
      txns.push({ from: db[0][0], to: cr[0][0], amount: amt });
      bal[cr[0][0]] -= amt; bal[db[0][0]] += amt;
    }
    return txns;
  })();

  const totalSpent = expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

  const splitSummary = e => {
    const amt = parseFloat(e.amount) || 0;
    const n = e.splitAmong.length, total = people.length;
    const share = n > 0 ? fmt(amt / n) : "$0.00";
    if (n === total) return { label: `All ${total} people · ${share} each`, color: C.green };
    if (n === 1) return { label: `Only ${e.splitAmong[0]} · ${share}`, color: C.blue };
    return { label: `${n} of ${total} people · ${share} each`, color: "#b45309" };
  };

  const tabBtn = t => ({
    padding: "8px 16px", border: "none", cursor: "pointer", fontWeight: 600, fontSize: 12,
    borderRadius: "6px 6px 0 0", background: tab === t ? "#fff" : C.bg,
    color: tab === t ? C.blue : C.gray,
    borderBottom: tab === t ? `2px solid ${C.blue}` : "2px solid transparent"
  });

  const statusColor = status === "saved" ? C.green : status === "saving" ? "#b45309" : status === "error" ? C.red : C.gray;
  const statusText = status === "loading" ? "Loading shared data..." : status === "saving" ? "Saving..." : status === "saved" ? `Saved · ${lastSaved?.toLocaleTimeString()}` : status === "error" ? "Error connecting — check internet" : "Ready";

  if (status === "loading") return (
    <div style={{ fontFamily: "Segoe UI, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", height: "80vh", flexDirection: "column", gap: 12, color: C.gray }}>
      <div style={{ fontSize: 32 }}>⏳</div>
      <div style={{ fontSize: 16, fontWeight: 600 }}>Loading shared expenses...</div>
      <div style={{ fontSize: 13 }}>Connecting to shared data</div>
    </div>
  );

  return (
    <div style={{ fontFamily: "Segoe UI, sans-serif", maxWidth: 900, margin: "0 auto", padding: 16, fontSize: 13 }}>
      {/* Header */}
      <div style={{ background: C.blue, borderRadius: 10, padding: "14px 18px", marginBottom: 14, color: "#fff" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 19, fontWeight: 700 }}>Trip Expense Splitter</div>
            <div style={{ opacity: 0.8, fontSize: 12, marginTop: 3 }}>Shared · All 14 people see the same data</div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: 6, padding: "4px 10px", fontSize: 11, color: "#fff" }}>
            <span style={{ color: status === "saved" ? "#86efac" : status === "error" ? "#fca5a5" : "#fde68a" }}>●</span> {statusText}
          </div>
        </div>
        <div style={{ display: "flex", gap: 20, marginTop: 10 }}>
          {[["Total Spent", fmt(totalSpent)], ["Per Person", fmt(totalSpent / people.length)], ["Expenses", expenses.length], ["Settlements", settlements.length]].map(([l, v]) => (
            <div key={l}><div style={{ fontSize: 20, fontWeight: 700 }}>{v}</div><div style={{ fontSize: 11, opacity: 0.75 }}>{l}</div></div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: `1px solid ${C.border}` }}>
        {["expenses","people","balances","settlements"].map(t => (
          <button key={t} style={tabBtn(t)} onClick={() => setTab(t)}>{t.charAt(0).toUpperCase()+t.slice(1)}</button>
        ))}
      </div>

      <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderTop: "none", borderRadius: "0 0 10px 10px", padding: 14 }}>

        {/* EXPENSES */}
        {tab === "expenses" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Expenses</div>
              <div style={{ display: "flex", gap: 8 }}>
                {expenses.length > 0 && <button onClick={clearAll} style={{ background: C.lr, color: C.red, border: `1px solid ${C.red}`, borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontWeight: 600, fontSize: 12 }}>Clear All</button>}
                <button onClick={addExpense} style={{ background: C.blue, color: "#fff", border: "none", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontWeight: 600, fontSize: 12 }}>+ Add Expense</button>
              </div>
            </div>

            {expenses.length === 0 && (
              <div style={{ textAlign: "center", padding: 40, color: C.gray }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🧾</div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>No expenses yet</div>
                <div style={{ fontSize: 12 }}>Click + Add Expense to get started</div>
              </div>
            )}

            {expenses.map((e, idx) => {
              const summary = splitSummary(e);
              const amt = parseFloat(e.amount) || 0;
              return (
                <div key={e.id} style={{ border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 12, overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: C.blue }}>
                    <div style={{ width: 22, height: 22, background: "rgba(255,255,255,0.25)", borderRadius: "50%", color: "#fff", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{idx+1}</div>
                    <div style={{ flex: 1, color: "#fff", fontWeight: 600, fontSize: 13 }}>
                      {e.type} {amt ? `· ${fmt(amt)}` : ""} {e.paidBy ? `· paid by ${e.paidBy}` : ""}
                    </div>
                    <button onClick={() => removeExpense(e.id)} style={{ background: "rgba(255,255,255,0.2)", color: "#fff", border: "none", borderRadius: 5, padding: "3px 10px", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>Remove</button>
                  </div>
                  <div style={{ padding: 12 }}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                      <div style={{ flex: "1 1 120px" }}>
                        <div style={{ fontSize: 11, color: C.gray, marginBottom: 3 }}>Paid By</div>
                        <select value={e.paidBy} onChange={ev => updateExpense(e.id, "paidBy", ev.target.value)}
                          style={{ width: "100%", padding: "6px 8px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12 }}>
                          {people.map(p => <option key={p}>{p}</option>)}
                        </select>
                      </div>
                      <div style={{ flex: "1 1 140px" }}>
                        <div style={{ fontSize: 11, color: C.gray, marginBottom: 3 }}>Expense Type</div>
                        <select value={e.type} onChange={ev => updateExpense(e.id, "type", ev.target.value)}
                          style={{ width: "100%", padding: "6px 8px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12 }}>
                          {EXPENSE_TYPES.map(t => <option key={t}>{t}</option>)}
                        </select>
                      </div>
                      <div style={{ flex: "1 1 90px" }}>
                        <div style={{ fontSize: 11, color: C.gray, marginBottom: 3 }}>Amount ($)</div>
                        <input type="number" value={e.amount} placeholder="0.00" min="0" step="0.01"
                          onChange={ev => updateExpense(e.id, "amount", ev.target.value)}
                          onBlur={ev => updateExpense(e.id, "amount", ev.target.value)}
                          style={{ width: "100%", padding: "6px 8px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12 }} />
                      </div>
                      <div style={{ flex: "2 1 180px" }}>
                        <div style={{ fontSize: 11, color: C.gray, marginBottom: 3 }}>Comment (optional)</div>
                        <input type="text" value={e.note} placeholder="e.g. only beach group..."
                          onChange={ev => updateExpense(e.id, "note", ev.target.value)}
                          onBlur={ev => updateExpense(e.id, "note", ev.target.value)}
                          style={{ width: "100%", padding: "6px 8px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12 }} />
                      </div>
                    </div>
                    <div style={{ background: C.bg, borderRadius: 8, padding: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>Split Among — <span style={{ color: summary.color }}>{summary.label}</span></div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => updateExpense(e.id, "splitAmong", [...people])}
                            style={{ fontSize: 11, padding: "3px 10px", borderRadius: 4, border: `1px solid ${C.blue}`, background: C.lb, color: C.blue, cursor: "pointer", fontWeight: 600 }}>All</button>
                          <button onClick={() => updateExpense(e.id, "splitAmong", [e.paidBy])}
                            style={{ fontSize: 11, padding: "3px 10px", borderRadius: 4, border: `1px solid ${C.border}`, background: "#fff", color: C.gray, cursor: "pointer" }}>Clear</button>
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(105px, 1fr))", gap: 5 }}>
                        {people.map(p => {
                          const included = e.splitAmong.includes(p);
                          return (
                            <button key={p} onClick={() => togglePerson(e.id, p)}
                              style={{ padding: "6px 8px", borderRadius: 6, cursor: "pointer", textAlign: "left", border: "1px solid",
                                borderColor: included ? C.green : C.border,
                                background: included ? C.lg : "#fff",
                                color: included ? C.green : C.gray, fontWeight: included ? 600 : 400, fontSize: 12 }}>
                              {p === e.paidBy && <span style={{ fontSize: 9, background: C.blue, color: "#fff", borderRadius: 3, padding: "1px 4px", marginRight: 4 }}>paid</span>}
                              {p}{included && <span style={{ float: "right" }}>✓</span>}
                            </button>
                          );
                        })}
                      </div>
                      {amt > 0 && <div style={{ marginTop: 8, fontSize: 11, color: C.gray, fontStyle: "italic" }}>Each person owes: <strong style={{ color: C.blue }}>{fmt(amt / e.splitAmong.length)}</strong></div>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* PEOPLE */}
        {tab === "people" && (
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Edit Names</div>
            <div style={{ fontSize: 12, color: C.gray, marginBottom: 12 }}>Changes sync to everyone instantly.</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8 }}>
              {people.map((p, idx) => (
                <div key={idx} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 10, background: C.bg }}>
                  <div style={{ fontSize: 11, color: C.gray, marginBottom: 4 }}>Person {idx+1}</div>
                  {editIdx === idx ? (
                    <div style={{ display: "flex", gap: 4 }}>
                      <input value={tmpName} autoFocus onChange={e => setTmpName(e.target.value)}
                        onKeyDown={e => { if (e.key==="Enter") saveName(idx); if (e.key==="Escape") setEditIdx(null); }}
                        style={{ flex: 1, padding: "4px 6px", border: `1px solid ${C.blue}`, borderRadius: 4, fontSize: 12 }} />
                      <button onClick={() => saveName(idx)} style={{ background: C.green, color: "#fff", border: "none", borderRadius: 4, padding: "4px 8px", cursor: "pointer" }}>✓</button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: 600 }}>{p}</span>
                      <button onClick={() => { setEditIdx(idx); setTmpName(p); }} style={{ background: "none", border: "none", cursor: "pointer", color: C.blue, fontSize: 12 }}>Edit</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* BALANCES */}
        {tab === "balances" && (
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Individual Balances</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8 }}>
              {people.map(p => {
                const b = balances[p] || 0;
                const pos = b > 0.005, neg = b < -0.005;
                return (
                  <div key={p} style={{ border: "1px solid", borderColor: pos ? C.green : neg ? C.red : C.border, borderRadius: 8, padding: 12, background: pos ? C.lg : neg ? C.lr : C.bg }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{p}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: pos ? C.green : neg ? C.red : C.gray }}>{pos?"+":neg?"-":""}{fmt(b)}</div>
                    <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>{pos?"is owed money":neg?"owes money":"settled up"}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SETTLEMENTS */}
        {tab === "settlements" && (
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Settlement Plan</div>
            <div style={{ fontSize: 12, color: C.gray, marginBottom: 12 }}>Minimum payments to settle all debts</div>
            {settlements.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: C.gray }}>{totalSpent === 0 ? "Add expenses to calculate settlements." : "Everyone is settled up! 🎉"}</div>
            ) : (
              <div>
                {settlements.map((s, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 8, background: C.bg }}>
                    <div style={{ width: 26, height: 26, background: C.blue, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11, fontWeight: 700 }}>{i+1}</div>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontWeight: 700, color: C.red }}>{s.from}</span>
                      <span style={{ color: C.gray }}> pays </span>
                      <span style={{ fontWeight: 700, color: C.green }}>{s.to}</span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 16, color: C.blue }}>{fmt(s.amount)}</div>
                  </div>
                ))}
                <div style={{ marginTop: 12, padding: 12, background: C.lb, borderRadius: 8, fontSize: 12, color: C.blue }}>
                  {settlements.length} payment{settlements.length !== 1?"s":""} needed to fully settle all debts.
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
