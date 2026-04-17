import { useState } from "react";
import { useLocation } from "wouter";
import { adminLogin, setAdminToken, forgotPassword, verifyOtp } from "@/lib/adminApi";
import { Loader2, Lock, User, Mail, ArrowLeft, KeyRound, Eye, EyeOff, ShieldCheck } from "lucide-react";

type Step = "login" | "email" | "otp" | "newpass" | "done";

export default function AdminLogin() {
  const [, setLocation] = useLocation();

  /* ── Login state ── */
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  /* ── Forgot-password wizard state ── */
  const [step, setStep] = useState<Step>("login");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [wizLoading, setWizLoading] = useState(false);

  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  /* ── Login ── */
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!username || !password) { setError("Please enter username and password"); return; }
    setLoginLoading(true); setError("");
    try {
      const { token } = await adminLogin(username, password);
      setAdminToken(token);
      localStorage.setItem("admin_user", username);
      setLocation("/admin/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally { setLoginLoading(false); }
  }

  /* ── Step: send OTP ── */
  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) { setError("Please enter the recovery email"); return; }
    setWizLoading(true); setError("");
    try {
      await forgotPassword(email.trim());
      setStep("otp");
      setInfo("A 6-digit OTP has been sent to your email. It expires in 10 minutes.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send OTP");
    } finally { setWizLoading(false); }
  }

  /* ── Step: verify OTP + set new password ── */
  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!otp.trim() || otp.length !== 6) { setError("Enter the 6-digit OTP from your email"); return; }
    if (!newPassword) { setError("Enter your new password"); return; }
    if (newPassword.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (newPassword !== confirmPassword) { setError("Passwords do not match"); return; }
    setWizLoading(true); setError("");
    try {
      const { token, username: u, role } = await verifyOtp(email.trim(), otp.trim(), newPassword);
      setAdminToken(token);
      localStorage.setItem("admin_user", u);
      localStorage.setItem("admin_role", role);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "OTP verification failed");
    } finally { setWizLoading(false); }
  }

  /* ── Reset wizard back to login ── */
  function backToLogin() { setStep("login"); setError(""); setInfo(""); setEmail(""); setOtp(""); setNewPassword(""); setConfirmPassword(""); }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "linear-gradient(135deg, #1B5E20 0%, #2E7D32 60%, #1B5E20 100%)" }}
    >
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-4 shadow-xl"
            style={{ background: "#fff", border: "3px solid #C9A14A" }}
          >
            <img
              src="/images/logo.png" alt="Prakriti Herbs"
              className="w-16 h-16 rounded-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          </div>
          <h1 className="text-2xl font-bold text-white">Prakriti Herbs</h1>
          <p className="text-sm mt-1" style={{ color: "#C9A14A" }}>Admin Panel</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">

          {/* ──── LOGIN ──── */}
          {step === "login" && (
            <>
              <h2 className="text-xl font-bold mb-6 text-gray-800 text-center">Sign In</h2>
              {error && <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm text-center">{error}</div>}
              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Username</label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                    <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-600/30 text-sm"
                      placeholder="Enter username" autoComplete="username" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                    <input type={showPass ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-600/30 text-sm"
                      placeholder="Enter password" autoComplete="current-password" />
                    <button type="button" onClick={() => setShowPass((v) => !v)}
                      className="absolute right-3 top-3 text-gray-400 hover:text-gray-600">
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <button type="submit" disabled={loginLoading}
                  className="w-full py-3 rounded-xl font-bold text-base flex items-center justify-center gap-2 transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-70"
                  style={{ background: "linear-gradient(135deg, #C9A14A 0%, #e8c96a 50%, #C9A14A 100%)", color: "#1B5E20" }}>
                  {loginLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</> : "Sign In"}
                </button>
                <div className="text-center">
                  <button type="button" onClick={() => { setStep("email"); setError(""); setInfo(""); }}
                    className="text-sm font-medium text-green-700 hover:text-green-800 hover:underline transition-colors">
                    Forgot Password?
                  </button>
                </div>
              </form>
            </>
          )}

          {/* ──── STEP 1: Enter email ──── */}
          {step === "email" && (
            <>
              <button onClick={backToLogin} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-5 -mt-1 transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back to login
              </button>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-green-50">
                  <KeyRound className="w-5 h-5 text-green-700" />
                </div>
                <div>
                  <h2 className="font-bold text-gray-900">Reset Password</h2>
                  <p className="text-xs text-gray-500">Enter the admin recovery email</p>
                </div>
              </div>
              {error && <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
              {info && <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-sm">{info}</div>}
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Recovery Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-600/30 text-sm"
                      placeholder="admin@example.com" autoComplete="email" />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Only the registered admin recovery email will receive an OTP.</p>
                </div>
                <button type="submit" disabled={wizLoading}
                  className="w-full py-3 rounded-xl font-bold text-base flex items-center justify-center gap-2 disabled:opacity-70 transition-all"
                  style={{ background: "linear-gradient(135deg, #C9A14A 0%, #e8c96a 50%, #C9A14A 100%)", color: "#1B5E20" }}>
                  {wizLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending OTP...</> : "Send OTP"}
                </button>
              </form>
            </>
          )}

          {/* ──── STEP 2: OTP + new password ──── */}
          {step === "otp" && (
            <>
              <button onClick={() => { setStep("email"); setError(""); }} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-5 -mt-1 transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-green-50">
                  <ShieldCheck className="w-5 h-5 text-green-700" />
                </div>
                <div>
                  <h2 className="font-bold text-gray-900">Enter OTP</h2>
                  <p className="text-xs text-gray-500">Check your email for the 6-digit code</p>
                </div>
              </div>
              {error && <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
              {info && <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">{info}</div>}
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">6-Digit OTP</label>
                  <input type="text" inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-center text-2xl font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-green-600/30"
                    placeholder="• • • • • •" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                    <input type={showNew ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-600/30 text-sm"
                      placeholder="Minimum 8 characters" autoComplete="new-password" />
                    <button type="button" onClick={() => setShowNew((v) => !v)} className="absolute right-3 top-3 text-gray-400 hover:text-gray-600">
                      {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Confirm New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                    <input type={showConfirm ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-600/30 text-sm"
                      placeholder="Re-enter new password" autoComplete="new-password" />
                    <button type="button" onClick={() => setShowConfirm((v) => !v)} className="absolute right-3 top-3 text-gray-400 hover:text-gray-600">
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <button type="submit" disabled={wizLoading}
                  className="w-full py-3 rounded-xl font-bold text-base flex items-center justify-center gap-2 disabled:opacity-70 transition-all"
                  style={{ background: "linear-gradient(135deg, #C9A14A 0%, #e8c96a 50%, #C9A14A 100%)", color: "#1B5E20" }}>
                  {wizLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying...</> : "Reset Password"}
                </button>
                <p className="text-center text-xs text-gray-400">
                  Didn't receive it?{" "}
                  <button type="button" onClick={() => { setStep("email"); setError(""); setInfo(""); }} className="text-green-700 hover:underline">Resend OTP</button>
                </p>
              </form>
            </>
          )}

          {/* ──── DONE ──── */}
          {step === "done" && (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
                <ShieldCheck className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Password Reset!</h2>
              <p className="text-sm text-gray-500 mb-6">Your password has been updated and all previous sessions have been logged out. A security alert was sent to <strong>contact@prakritiherbs.in</strong>.</p>
              <button onClick={() => setLocation("/admin/dashboard")}
                className="w-full py-3 rounded-xl font-bold text-base transition-all hover:brightness-110"
                style={{ background: "linear-gradient(135deg, #C9A14A 0%, #e8c96a 50%, #C9A14A 100%)", color: "#1B5E20" }}>
                Go to Dashboard
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-xs mt-6" style={{ color: "rgba(255,255,255,0.5)" }}>
          © 2026 Prakriti Herbs. Secure Admin Access.
        </p>
      </div>
    </div>
  );
}
