"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        try {
            const res = await fetch("/api/auth", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password }),
            });

            if (res.ok) {
                router.push("/");
                router.refresh();
            } else {
                setError("Incorrect password. Access denied.");
            }
        } catch (err) {
            setError("Something went wrong!");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <main className="flex min-h-screen items-center justify-center bg-[#f4f4f0] p-4 font-mono">
            <div className="w-full max-w-md bg-white border-4 border-black shadow-[8px_8px_0_0_#000] p-8">
                <h1 className="text-4xl font-black uppercase mb-6 text-black tracking-tight">
                    Rover<br/><span className="text-[#ff0055]">Access</span>
                </h1>
                
                <form onSubmit={handleLogin} className="flex flex-col gap-4">
                    <div>
                        <label className="block text-xl font-bold mb-2">Password</label>
                        <input 
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter override code"
                            className="w-full border-4 border-black p-3 text-lg font-bold focus:outline-none focus:bg-[#f0f0f0] transition-colors shadow-[4px_4px_0_0_#000] focus:shadow-[2px_2px_0_0_#000] focus:translate-x-[2px] focus:translate-y-[2px]"
                        />
                    </div>
                    
                    {error && (
                        <div className="bg-[#ff0055] text-white border-4 border-black p-3 font-bold mt-2 shadow-[4px_4px_0_0_#000]">
                            {error}
                        </div>
                    )}

                    <button 
                        type="submit"
                        disabled={isLoading}
                        className="mt-4 bg-[#00ffcc] hover:bg-[#00ccaa] text-black border-4 border-black p-4 text-xl font-extrabold uppercase shadow-[6px_6px_0_0_#000] hover:shadow-[2px_2px_0_0_#000] hover:translate-x-[4px] hover:translate-y-[4px] active:shadow-none active:translate-x-[6px] active:translate-y-[6px] transition-all disabled:opacity-50"
                    >
                        {isLoading ? "Authenticating..." : "Login"}
                    </button>
                </form>

                <div className="mt-8 pt-6 border-t-4 border-black text-center">
                    <p className="font-black uppercase text-xs tracking-widest text-[#000000] opacity-30">
                        Made by Prerith.M
                    </p>
                </div>
            </div>
        </main>
    );
}
