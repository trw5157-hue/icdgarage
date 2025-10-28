import { useState } from "react";
import { useAuth } from "@/App";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const LoginPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [registerUsername, setRegisterUsername] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerFullName, setRegisterFullName] = useState("");
  const [registerRole, setRegisterRole] = useState("Mechanic");
  const [loading, setLoading] = useState(false);
  
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(loginUsername, loginPassword);
      toast.success("Login successful!");
      navigate(user.role === "Manager" ? "/manager" : "/mechanic");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await register(registerUsername, registerPassword, registerFullName, registerRole);
      toast.success("Registration successful!");
      navigate(user.role === "Manager" ? "/manager" : "/mechanic");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4" data-testid="login-page">
      <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-8 items-center">
        {/* Left Side - Branding */}
        <div className="hidden lg:flex flex-col space-y-6 text-white">
          <div className="space-y-4">
            <img 
              src={process.env.REACT_APP_LOGO_URL} 
              alt="ICD Tuning Logo" 
              className="w-64 h-auto"
            />
            <h1 className="text-5xl font-bold heading-font" style={{ color: '#D32F2F' }}>
              ICD TUNING
            </h1>
            <p className="text-xl text-gray-300">
              Performance Tuning | Repair & Services
            </p>
          </div>
          <div className="space-y-4 pt-8">
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-lg">Complete Workflow Management</h3>
                <p className="text-gray-400 text-sm">Track every car from entry to delivery</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-lg">Real-time Progress Tracking</h3>
                <p className="text-gray-400 text-sm">Mechanics update status on the go</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-lg">Automated Invoicing & Notifications</h3>
                <p className="text-gray-400 text-sm">Generate branded invoices instantly</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Auth Forms */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="text-center lg:text-left">
            <CardTitle className="text-xl md:text-2xl text-white heading-font">Welcome to ICD Tuning</CardTitle>
            <CardDescription className="text-gray-400">Sign in to your account or create a new one</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={isLogin ? "login" : "register"} onValueChange={(v) => setIsLogin(v === "login")} className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-zinc-800 mb-6">
                <TabsTrigger value="login" data-testid="login-tab" className="text-sm md:text-base">Login</TabsTrigger>
                <TabsTrigger value="register" data-testid="register-tab" className="text-sm md:text-base">Register</TabsTrigger>
              </TabsList>
              
              <TabsContent value="login" className="space-y-4 mt-6">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-username" className="text-white">Username</Label>
                    <Input
                      id="login-username"
                      data-testid="login-username-input"
                      type="text"
                      placeholder="manager"
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      required
                      className="bg-zinc-800 border-zinc-700 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password" className="text-white">Password</Label>
                    <Input
                      id="login-password"
                      data-testid="login-password-input"
                      type="password"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                      className="bg-zinc-800 border-zinc-700 text-white"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full bg-red-600 hover:bg-red-700 text-white btn-hover-lift"
                    disabled={loading}
                    data-testid="login-submit-button"
                  >
                    {loading ? "Signing in..." : "Sign In"}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="register" className="space-y-4 mt-6">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="register-fullname" className="text-white">Full Name</Label>
                    <Input
                      id="register-fullname"
                      data-testid="register-fullname-input"
                      type="text"
                      placeholder="Rajesh Kumar"
                      value={registerFullName}
                      onChange={(e) => setRegisterFullName(e.target.value)}
                      required
                      className="bg-zinc-800 border-zinc-700 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-username" className="text-white">Username</Label>
                    <Input
                      id="register-username"
                      data-testid="register-username-input"
                      type="text"
                      placeholder="manager123"
                      value={registerUsername}
                      onChange={(e) => setRegisterUsername(e.target.value)}
                      required
                      className="bg-zinc-800 border-zinc-700 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-password" className="text-white">Password</Label>
                    <Input
                      id="register-password"
                      data-testid="register-password-input"
                      type="password"
                      placeholder="••••••••"
                      value={registerPassword}
                      onChange={(e) => setRegisterPassword(e.target.value)}
                      required
                      className="bg-zinc-800 border-zinc-700 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-role" className="text-white">Role</Label>
                    <Select value={registerRole} onValueChange={setRegisterRole}>
                      <SelectTrigger data-testid="register-role-select" className="bg-zinc-800 border-zinc-700 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-800 border-zinc-700">
                        <SelectItem value="Manager">Manager</SelectItem>
                        <SelectItem value="Mechanic">Mechanic</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full bg-red-600 hover:bg-red-700 text-white btn-hover-lift"
                    disabled={loading}
                    data-testid="register-submit-button"
                  >
                    {loading ? "Creating account..." : "Create Account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LoginPage;