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
  const [secretCode, setSecretCode] = useState("");
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
    
    // Validate secret code
    if (secretCode !== "5157") {
      toast.error("Invalid secret code. Please contact admin for access.");
      return;
    }
    
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
      <div className="w-full max-w-4xl mx-auto space-y-8">
        {/* Top - Logo and Branding (Always Visible) */}
        <div className="text-center text-white space-y-3">
          <img 
            src={process.env.REACT_APP_LOGO_URL} 
            alt="ICD Tuning Logo" 
            className="w-64 md:w-80 h-auto mx-auto"
          />
          <h1 className="text-4xl md:text-5xl font-bold heading-font" style={{ color: '#D32F2F' }}>
            ICD TUNING
          </h1>
          <p className="text-lg md:text-xl text-gray-300">
            Performance Tuning | Repair & Services
          </p>
        </div>

        {/* Auth Forms Card */}
        <Card className="bg-zinc-900 border-zinc-800 max-w-2xl mx-auto">
          <CardHeader className="text-center">
            <CardTitle className="text-xl md:text-2xl text-white heading-font">Welcome to ICD Tuning</CardTitle>
            <CardDescription className="text-gray-400">Sign in to your account or create a new one</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={isLogin ? "login" : "register"} onValueChange={(v) => setIsLogin(v === "login")} className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-zinc-800 mb-6 h-14">
                <TabsTrigger 
                  value="login" 
                  data-testid="login-tab" 
                  className="text-base md:text-lg font-semibold data-[state=active]:bg-red-600 data-[state=active]:text-white"
                >
                  Login
                </TabsTrigger>
                <TabsTrigger 
                  value="register" 
                  data-testid="register-tab" 
                  className="text-base md:text-lg font-semibold data-[state=active]:bg-red-600 data-[state=active]:text-white"
                >
                  Register
                </TabsTrigger>
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
                  <div className="space-y-2">
                    <Label htmlFor="secret-code" className="text-white">
                      Secret Code <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="secret-code"
                      data-testid="secret-code-input"
                      type="password"
                      placeholder="Enter secret code"
                      value={secretCode}
                      onChange={(e) => setSecretCode(e.target.value)}
                      required
                      className="bg-zinc-800 border-zinc-700 text-white"
                    />
                    <p className="text-xs text-gray-400">
                      Contact administrator for registration access code
                    </p>
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