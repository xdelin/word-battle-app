"use client";
// dev 重编译触发
import { useState, useEffect, useCallback } from "react";
import { Plus, Users, Hash, Settings, LogOut, Crown, Lock, Check, X, Trash2, Copy } from "lucide-react";
import {
  createStudyRoom, fetchStudyRoomPlaza, joinStudyRoom, fetchMyStudyRooms, fetchStudyRoomDetail,
  leaveStudyRoom, updateStudyRoom, fetchStudyRoomApplications, approveStudyRoomApplication, rejectStudyRoomApplication,
  remindStudyRoomMember, fetchMyStudyRoomReminders, markStudyRoomReminderRead, kickStudyRoomMember,
  type StudyRoomDto, type RoomDetailDto, type StudyRoomMemberDto, type StudyRoomApplicationDto, type ReminderDto,
} from "@/lib/api-client";

export default function StudyRoomPage() {
  const [myRoom, setMyRoom] = useState<StudyRoomDto | null>(null);
  const [plaza, setPlaza] = useState<StudyRoomDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const mine = await fetchMyStudyRooms();
      const first = mine[0] ?? null;
      setMyRoom(first);
      if (!first) setPlaza(await fetchStudyRoomPlaza());
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleJoin = async (code: string) => {
    const c = code.trim().toUpperCase();
    if (!c) return;
    setJoining(true); setError(null);
    try {
      await joinStudyRoom(c);
      setJoinCode("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "加入失败");
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return <main className="min-h-[100dvh] bg-[#fafafa] dark:bg-gray-950 flex items-center justify-center text-gray-400 text-sm">加载中…</main>;
  }

  // 已加入自习室：直接显示自习室界面
  if (myRoom) {
    return <RoomView room={myRoom} onLeft={load} onError={setError} />;
  }

  // 未加入：广场 + 加入码 + 创建
  return (
    <main className="min-h-[100dvh] bg-[#fafafa] dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <div className="max-w-md mx-auto px-5 pt-10 pb-[calc(88px+env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">背词自习室</h1>
            <p className="mt-1 text-sm text-gray-400">一起背词，互相监督</p>
          </div>
          <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-gray-900 text-white text-xs font-medium hover:bg-gray-700 dark:bg-white dark:text-gray-900 transition-colors">
            <Plus className="h-4 w-4" /> 创建
          </button>
        </div>

        {error && <div className="mb-4 px-4 py-3 rounded-2xl bg-rose-50 text-rose-700 text-sm">{error}</div>}

        <section className="mb-8">
          <h2 className="text-xs text-gray-400 uppercase tracking-wider mb-2">加入码加入</h2>
          <div className="flex gap-2">
            <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="输入 6 位加入码" maxLength={6}
              className="flex-1 h-11 px-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-sm tracking-widest text-center focus:outline-none focus:border-gray-400 transition-colors" />
            <button onClick={() => handleJoin(joinCode)} disabled={joining || !joinCode.trim()}
              className="h-11 px-5 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 disabled:opacity-40 dark:bg-white dark:text-gray-900 transition-colors">
              {joining ? "加入中" : "加入"}
            </button>
          </div>
        </section>

        <section>
          <h2 className="text-xs text-gray-400 uppercase tracking-wider mb-2">广场自习室</h2>
          {plaza.length === 0 ? (
            <div className="text-sm text-gray-400 py-8 text-center">暂无公开自习室</div>
          ) : (
            <div className="space-y-2">
              {plaza.map((r) => (
                <div key={r.id} className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
                  <div className="h-10 w-10 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-500 flex items-center justify-center shrink-0"><Users className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold truncate flex items-center gap-1.5">{r.name}{r.requireApproval && <Lock className="h-3 w-3 text-gray-400" />}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{r.memberCount} 人 · 每日 {r.dailyGoal} 词</div>
                  </div>
                  <button onClick={() => handleJoin(r.code)} disabled={joining}
                    className="shrink-0 h-8 px-3 rounded-full bg-gray-900 text-white text-xs font-medium hover:bg-gray-700 disabled:opacity-40 dark:bg-white dark:text-gray-900 transition-colors">加入</button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {showCreate && <CreateRoomModal onClose={() => setShowCreate(false)} onCreated={load} />}
    </main>
  );
}

/** 已加入自习室的界面：成员列表 + 右上角设置。 */
function RoomView({ room, onLeft, onError }: { room: StudyRoomDto; onLeft: () => void; onError: (s: string) => void }) {
  const [detail, setDetail] = useState<RoomDetailDto | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedMember, setSelectedMember] = useState<StudyRoomMemberDto | null>(null);
  const [reminders, setReminders] = useState<ReminderDto[]>([]);

  const loadDetail = useCallback(async () => {
    try {
      setDetail(await fetchStudyRoomDetail(room.id));
      setReminders(await fetchMyStudyRoomReminders(room.id));
    } catch (e) {
      // 404 = 自习室已不存在（可能已被解除），静默交由上层刷新
      const msg = e instanceof Error ? e.message : "加载失败";
      if (!msg.includes("404")) onError(msg);
    }
  }, [room.id, onError]);
  useEffect(() => { loadDetail(); }, [loadDetail]);

  const goal = detail?.room.dailyGoal ?? room.dailyGoal;

  const dismissReminder = async (id: string) => {
    try {
      await markStudyRoomReminderRead(id);
      setReminders(await fetchMyStudyRoomReminders(room.id));
    } catch { /* ignore */ }
  };

  return (
    <main className="min-h-[100dvh] bg-[#fafafa] dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <div className="max-w-md mx-auto px-5 pt-10 pb-[calc(88px+env(safe-area-inset-bottom))]">
        {/* 未读提醒条 */}
        {reminders.length > 0 && (
          <div className="mb-4 flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <div className="h-8 w-8 rounded-full bg-amber-200 dark:bg-amber-800 overflow-hidden shrink-0 flex items-center justify-center text-sm">
              {reminders[0].fromUserAvatar ? <img src={reminders[0].fromUserAvatar} alt="" className="w-full h-full object-cover" /> : reminders[0].fromUserName[0]}
            </div>
            <div className="flex-1 text-sm min-w-0">
              <span className="font-medium">{reminders[0].fromUserName}</span>
              <span className="text-gray-600 dark:text-gray-300"> {reminders[0].message}</span>
            </div>
            <button onClick={() => dismissReminder(reminders[0].id)} className="shrink-0 text-xs font-medium text-amber-700 dark:text-amber-300 hover:opacity-70">知道了</button>
          </div>
        )}

        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{room.name}</h1>
            <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
              <span className="flex items-center gap-0.5"><Hash className="h-3 w-3" />{room.code}</span>
              <span>·</span><span>每日 {goal} 词</span>
              <span>·</span><span>{detail?.room.memberCount ?? room.memberCount} 人</span>
            </div>
          </div>
          <button onClick={() => setShowSettings(true)}
            className="inline-flex items-center justify-center h-9 w-9 rounded-full border border-gray-200 dark:border-gray-800 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors">
            <Settings className="h-4 w-4" />
          </button>
        </div>

        <h2 className="text-xs text-gray-400 uppercase tracking-wider mb-2">成员（点击查看详情）</h2>
        {!detail ? (
          <div className="text-sm text-gray-400 py-6 text-center">加载中…</div>
        ) : (
          <div className="space-y-2">
            {detail.members.map((m) => {
              const today = (m.todayNewWords ?? 0) + (m.todayReviewWords ?? 0);
              const checkedIn = today >= goal;
              return (
                <button
                  key={m.userId}
                  onClick={() => setSelectedMember(m)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 transition-colors text-left"
                >
                  <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden shrink-0">
                    {m.avatarUrl && <img src={m.avatarUrl} alt={m.name} className="w-full h-full object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold truncate flex items-center gap-1.5">
                      {m.name}
                      {m.isAdmin && <Crown className="h-3.5 w-3.5 text-amber-500" />}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      今日 {today} 词 · 连续 {m.streakDays ?? 0} 天 · 累计 {m.totalStudyDays ?? 0} 天
                    </div>
                  </div>
                  <span className={`shrink-0 text-[11px] px-2 py-0.5 rounded-full ${checkedIn ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-gray-100 text-gray-400 dark:bg-gray-800"}`}>
                    {checkedIn ? "已打卡" : `${today}/${goal}`}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {showSettings && (
        <SettingsModal
          room={detail?.room ?? room}
          isAdmin={detail?.currentUserIsAdmin ?? false}
          roomId={room.id}
          onClose={() => setShowSettings(false)}
          onChanged={async () => { await loadDetail(); await onLeft(); }}
          onLeft={onLeft}
        />
      )}

      {selectedMember && (
        <MemberDetailModal
          member={selectedMember}
          goal={goal}
          roomId={room.id}
          isSelf={selectedMember.userId === detail?.currentUserId}
          isAdmin={detail?.currentUserIsAdmin ?? false}
          onChanged={loadDetail}
          onClose={() => setSelectedMember(null)}
        />
      )}
    </main>
  );
}

/** 成员详情弹窗：学习统计 + 底部提醒打卡按钮（自己不显示）+ 管理员移除按钮。 */
function MemberDetailModal({ member, goal, roomId, isSelf, isAdmin, onChanged, onClose }: {
  member: StudyRoomMemberDto; goal: number; roomId: string; isSelf: boolean; isAdmin: boolean;
  onChanged: () => void; onClose: () => void;
}) {
  const [reminding, setReminding] = useState(false);
  const [reminded, setReminded] = useState(false);
  const [kicking, setKicking] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const todayNew = member.todayNewWords ?? 0;
  const todayReview = member.todayReviewWords ?? 0;
  const today = todayNew + todayReview;
  const checkedIn = today >= goal;

  const remind = async () => {
    setReminding(true); setErr(null);
    try { await remindStudyRoomMember(roomId, member.userId); setReminded(true); }
    catch (e) { setErr(e instanceof Error ? e.message : "提醒失败"); }
    finally { setReminding(false); }
  };

  const kick = async () => {
    if (typeof window !== "undefined" && !window.confirm(`确定将 ${member.name} 移出自习室？`)) return;
    setKicking(true); setErr(null);
    try { await kickStudyRoomMember(roomId, member.userId); onChanged(); onClose(); }
    catch (e) { setErr(e instanceof Error ? e.message : "移除失败"); }
    finally { setKicking(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center px-6" onClick={onClose}>
      <div className="w-full max-w-sm bg-white dark:bg-gray-950 rounded-3xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-col items-center mb-5">
          <div className="h-16 w-16 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden flex items-center justify-center text-xl font-semibold text-gray-500">
            {member.avatarUrl ? <img src={member.avatarUrl} alt={member.name} className="w-full h-full object-cover" /> : member.name[0]}
          </div>
          <div className="mt-2 text-lg font-semibold flex items-center gap-1.5">
            {member.name}
            {member.isAdmin && <Crown className="h-4 w-4 text-amber-500" />}
          </div>
          <span className={`mt-1 text-[11px] px-2.5 py-0.5 rounded-full ${checkedIn ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-gray-100 text-gray-500 dark:bg-gray-800"}`}>
            {checkedIn ? "今日已打卡" : `今日 ${today}/${goal} 词`}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-5">
          <StatCard label="今日新学" value={todayNew} />
          <StatCard label="今日复习" value={todayReview} />
          <StatCard label="连续天数" value={member.streakDays ?? 0} suffix="天" />
          <StatCard label="累计学习" value={member.totalStudyDays ?? 0} suffix="天" />
        </div>

        {err && <div className="mb-3 px-3 py-2 rounded-xl bg-rose-50 text-rose-700 text-xs text-center">{err}</div>}

        {isSelf ? (
          <div className="text-center text-xs text-gray-400 py-2">这是你自己～继续加油背词吧</div>
        ) : (
          <div className="space-y-2">
            <button onClick={remind} disabled={reminding || reminded}
              className="w-full h-11 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 disabled:opacity-50 dark:bg-white dark:text-gray-900 transition-colors">
              {reminded ? "已提醒" : reminding ? "提醒中…" : "提醒打卡"}
            </button>
            {isAdmin && (
              <button onClick={kick} disabled={kicking}
                className="w-full h-11 rounded-xl border border-gray-200 dark:border-gray-800 text-sm font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 disabled:opacity-50 transition-colors">
                {kicking ? "移除中…" : "移除出自习室"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="rounded-2xl bg-gray-50 dark:bg-gray-800/60 p-3 text-center">
      <div className="text-xl font-bold tabular-nums">{value}{suffix}</div>
      <div className="text-[11px] text-gray-400 mt-0.5">{label}</div>
    </div>
  );
}

/** 设置弹窗：退出 + 管理员设置/审核。 */
function SettingsModal({ room, isAdmin, roomId, onClose, onChanged, onLeft }: {
  room: StudyRoomDto; isAdmin: boolean; roomId: string;
  onClose: () => void; onChanged: () => void; onLeft: () => void;
}) {
  const [name, setName] = useState(room.name);
  const [isPublic, setIsPublic] = useState(room.isPublic);
  const [requireApproval, setRequireApproval] = useState(room.requireApproval);
  const [dailyGoal, setDailyGoal] = useState(room.dailyGoal);
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [apps, setApps] = useState<StudyRoomApplicationDto[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  const loadApps = useCallback(async () => {
    if (!isAdmin) return;
    try { setApps(await fetchStudyRoomApplications(roomId)); } catch {}
  }, [isAdmin, roomId]);
  useEffect(() => { loadApps(); }, [loadApps]);

  const save = async () => {
    setSaving(true); setErr(null);
    try {
      await updateStudyRoom(roomId, { name: name.trim(), isPublic, requireApproval, dailyGoal });
      await onChanged();
      onClose();
    } catch (e) { setErr(e instanceof Error ? e.message : "保存失败"); }
    finally { setSaving(false); }
  };

  const leave = async () => {
    const msg = isAdmin
      ? "解除自习室将删除整个自习室及所有成员记录，不可恢复。确定解除？"
      : "确定退出该自习室？退出后可重新通过加入码加入。";
    if (typeof window !== "undefined" && !window.confirm(msg)) return;
    setLeaving(true); setErr(null);
    try {
      await leaveStudyRoom(roomId);
    } catch (e) {
      const emsg = e instanceof Error ? e.message : "操作失败";
      // 404 = 自习室已不存在（可能已被解除），视为已成功退出
      if (!emsg.includes("404")) { setErr(emsg); setLeaving(false); return; }
    }
    onClose();
    onLeft();
    setLeaving(false);
  };

  const handleApp = async (appId: string, approve: boolean) => {
    try {
      if (approve) await approveStudyRoomApplication(roomId, appId);
      else await rejectStudyRoomApplication(roomId, appId);
      await loadApps();
      await onChanged();
    } catch (e) { setErr(e instanceof Error ? e.message : "操作失败"); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center px-6" onClick={onClose}>
      <div className="w-full max-w-sm max-h-[85dvh] overflow-y-auto bg-white dark:bg-gray-950 rounded-3xl p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold mb-4">自习室设置</h3>

        {/* 分享自习室（所有人可邀请） */}
        <div className="mb-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800">
          <div className="text-xs text-gray-400 mb-2">邀请好友加入</div>
          <div className="flex items-center gap-2">
            <div className="flex-1 text-center text-2xl font-bold tracking-[0.3em] text-gray-900 dark:text-white">{room.code}</div>
            <button onClick={copyCode}
              className="shrink-0 h-9 px-3 rounded-lg bg-gray-900 text-white text-xs font-medium hover:bg-gray-700 dark:bg-white dark:text-gray-900 transition-colors flex items-center gap-1">
              {copied ? <><Check className="h-3.5 w-3.5" />已复制</> : <><Copy className="h-3.5 w-3.5" />复制</>}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2 text-center">把加入码发给好友，TA 在自习室广场输入即可加入</p>
        </div>

        {isAdmin && (
          <>
            <label className="block text-xs text-gray-400 mb-1.5">名称</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              className="w-full h-11 px-4 mb-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:border-gray-400 transition-colors" />
            <label className="block text-xs text-gray-400 mb-1.5">每日记单词要求</label>
            <input type="number" value={dailyGoal} onChange={(e) => setDailyGoal(Math.max(1, Number(e.target.value) || 1))}
              className="w-full h-11 px-4 mb-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:border-gray-400 transition-colors" />
            <div className="space-y-2 mb-4">
              <Toggle label="在广场公开" desc="其他用户可在广场看到" checked={isPublic} onChange={setIsPublic} />
              <Toggle label="加入需要审核" desc="用户申请后需管理员通过" checked={requireApproval} onChange={setRequireApproval} />
            </div>
            <button onClick={save} disabled={saving}
              className="w-full h-11 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 disabled:opacity-50 dark:bg-white dark:text-gray-900 transition-colors mb-4">
              {saving ? "保存中" : "保存设置"}
            </button>

            {/* 审核列表 */}
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs text-gray-400 uppercase tracking-wider">加入申请</h4>
              {apps.length > 0 && <span className="text-[11px] text-amber-600">{apps.length} 待审</span>}
            </div>
            {apps.length === 0 ? (
              <div className="text-xs text-gray-400 py-3 text-center mb-4">暂无申请</div>
            ) : (
              <div className="space-y-2 mb-4">
                {apps.map((a) => (
                  <div key={a.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800">
                    <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden shrink-0">
                      {a.avatarUrl && <img src={a.avatarUrl} alt={a.userName} className="w-full h-full object-cover" />}
                    </div>
                    <span className="text-sm font-medium flex-1 truncate">{a.userName}</span>
                    <button onClick={() => handleApp(a.id, true)} className="h-7 w-7 rounded-full bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-600 transition-colors"><Check className="h-4 w-4" /></button>
                    <button onClick={() => handleApp(a.id, false)} className="h-7 w-7 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"><X className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {err && <div className="mb-3 px-3 py-2 rounded-xl bg-rose-50 text-rose-700 text-xs">{err}</div>}

        <button onClick={leave} disabled={leaving}
          className="w-full h-11 rounded-xl border border-gray-200 dark:border-gray-800 text-sm font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors flex items-center justify-center gap-1.5">
          {isAdmin ? <Trash2 className="h-4 w-4" /> : <LogOut className="h-4 w-4" />}
          {leaving ? (isAdmin ? "解除中" : "退出中") : (isAdmin ? "解除自习室" : "退出自习室")}
        </button>
      </div>
    </div>
  );
}

function Toggle({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)} className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 text-left">
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-gray-400 mt-0.5">{desc}</div>
      </div>
      <span className={`w-10 h-6 rounded-full p-0.5 transition-colors ${checked ? "bg-gray-900 dark:bg-white" : "bg-gray-200 dark:bg-gray-700"}`}>
        <span className={`block w-5 h-5 rounded-full bg-white dark:bg-gray-900 transition-transform ${checked ? "translate-x-4" : ""}`} />
      </span>
    </button>
  );
}

function CreateRoomModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [requireApproval, setRequireApproval] = useState(false);
  const [dailyGoal, setDailyGoal] = useState(20);
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim()) { setErr("请填写自习室名称"); return; }
    setCreating(true); setErr(null);
    try { await createStudyRoom({ name: name.trim(), isPublic, requireApproval, dailyGoal }); onCreated(); }
    catch (e) { setErr(e instanceof Error ? e.message : "创建失败"); }
    finally { setCreating(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center px-6" onClick={onClose}>
      <div className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold mb-4">创建自习室</h3>
        <label className="block text-xs text-gray-400 mb-1.5">名称</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：四级冲刺自习室"
          className="w-full h-11 px-4 mb-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:border-gray-400 transition-colors" />
        <label className="block text-xs text-gray-400 mb-1.5">每日记单词要求</label>
        <input type="number" value={dailyGoal} onChange={(e) => setDailyGoal(Math.max(1, Number(e.target.value) || 1))}
          className="w-full h-11 px-4 mb-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:border-gray-400 transition-colors" />
        <div className="space-y-2 mb-5">
          <Toggle label="在广场公开" desc="其他用户可在广场看到并加入" checked={isPublic} onChange={setIsPublic} />
          <Toggle label="加入需要审核" desc="用户申请后需管理员通过" checked={requireApproval} onChange={setRequireApproval} />
        </div>
        {err && <div className="mb-3 px-3 py-2 rounded-xl bg-rose-50 text-rose-700 text-xs">{err}</div>}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 h-11 rounded-xl border border-gray-200 dark:border-gray-800 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">取消</button>
          <button onClick={submit} disabled={creating} className="flex-1 h-11 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 disabled:opacity-50 dark:bg-white dark:text-gray-900 transition-colors">{creating ? "创建中" : "创建"}</button>
        </div>
      </div>
    </div>
  );
}
