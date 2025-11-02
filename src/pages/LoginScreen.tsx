import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Stethoscope, Heart, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const LoginScreen = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    name: ""
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const backendBase = import.meta.env.DEV ? '' : (import.meta.env.VITE_TAVUS_BACKEND_URL || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (isLogin) {
      // Handle login
      setIsLoading(true);
      try {
        console.log('[login] attempting login for', formData.email);
        const response = await fetch(`${backendBase}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password
          })
        });

        if (response.ok) {
          const data = await response.json();
          console.log('[login] success', data);
          
          // Store user data and JWT token in localStorage
          localStorage.setItem('user', JSON.stringify(data.user));
          localStorage.setItem('userId', data.user.id);
          if (data.token) {
            localStorage.setItem('auth_token', data.token);
            console.log('[login] JWT token stored');
          }
          
          // Pre-warm the custom LLM after successful login
          console.log('[login] 🔥 Pre-warming custom LLM...');
          const warmupStart = performance.now();
          try {
            const warmupResp = await fetch(`${backendBase}/healthz`, {
              method: 'GET',
              signal: AbortSignal.timeout(15000),
            });
            const warmupDuration = ((performance.now() - warmupStart) / 1000).toFixed(2);
            if (warmupResp.ok) {
              console.log(`[login] ✅ LLM warmed up successfully (${warmupDuration}s)`);
            } else {
              console.warn(`[login] ⚠️ LLM pre-warm failed (${warmupDuration}s): Status ${warmupResp.status}`);
            }
          } catch (warmupErr) {
            const message = warmupErr instanceof Error ? warmupErr.message : String(warmupErr);
            console.error(`[login] ❌ LLM pre-warm error: ${message}`);
            // Non-fatal - continue to app even if warmup fails
          }
          
          navigate("/introduction");
        } else {
          const errorData = await response.json();
          console.error('[login] failed', errorData);
          setError(errorData.message || 'Invalid email or password');
        }
      } catch (error) {
        console.error('[login] error', error);
        setError('Unable to connect to server. Please try again.');
      } finally {
        setIsLoading(false);
      }
    } else {
      // Handle signup (not implemented yet)
      setError("Signup is not yet implemented. Please contact your administrator.");
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(""); // Clear error when user types
  };

  return (
    <div className="min-h-screen bg-gradient-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="bg-primary p-3 rounded-full">
              <Stethoscope className="h-8 w-8 text-primary-foreground" />
            </div>
            <Heart className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            GeneticsCare AI
          </h1>
          <p className="text-muted-foreground">
            Your trusted genetics counseling companion
          </p>
        </div>

        {/* Login/Signup Card */}
        <Card className="shadow-professional">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">
              {isLogin ? "Welcome back" : "Create account"}
            </CardTitle>
            <CardDescription className="text-center">
              {isLogin 
                ? "Sign in to access your genetic health insights"
                : "Join us to understand your genetic health better"
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    required={!isLogin}
                  />
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => handleInputChange("password", e.target.value)}
                  required
                />
              </div>

              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                    required={!isLogin}
                  />
                </div>
              )}

              <Button type="submit" className="w-full bg-gradient-primary" disabled={isLoading}>
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Signing in...
                  </div>
                ) : (
                  isLogin ? "Sign In" : "Create Account"
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-primary hover:underline"
              >
                {isLogin 
                  ? "Don't have an account? Sign up" 
                  : "Already have an account? Sign in"
                }
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Medical Disclaimer */}
        <div className="mt-6 p-4 bg-secondary rounded-lg border-l-4 border-primary">
          <p className="text-sm text-muted-foreground">
            <strong>Medical Disclaimer:</strong> This AI tool is not a doctor or nurse. 
            Information provided should be discussed with qualified healthcare professionals.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;