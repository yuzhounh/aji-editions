
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFirebase } from "@/firebase";
import {
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
} from "firebase/auth";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/i18n/provider";

const formSchema = (view: 'login' | 'register' | 'reset', t: (key: string) => string) => z.object({
  email: z.string().email({ message: "Please enter a valid email." }),
  password: z.string().optional(),
  confirmPassword: z.string().optional(),
  displayName: z.string().optional(),
}).refine(data => {
    if (view !== 'register') return true;
    return data.password && data.password.length >= 6;
}, {
    message: "Password must be at least 6 characters.",
    path: ["password"],
}).refine(data => {
    if (view !== 'register') return true; 
    return data.password === data.confirmPassword;
}, {
    message: t('auth.passwordsDoNotMatch'),
    path: ["confirmPassword"],
}).refine(data => {
    if (view !== 'register') return true;
    return !!data.displayName && data.displayName.length >= 2;
}, {
    message: t('auth.nicknameRequired'),
    path: ["displayName"],
});


type FormValues = z.infer<ReturnType<typeof formSchema>>;

interface LoginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function LoginDialog({ open, onOpenChange }: LoginDialogProps) {
  const { auth } = useFirebase();
  const [isLoading, setIsLoading] = useState(false);
  const [view, setView] = useState<'login' | 'register' | 'reset'>("login");
  const { toast } = useToast();
  const { t } = useTranslation();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema(view, t)),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      displayName: "",
    },
    // Re-validate when view changes
    context: { view },
  });
  
  // Effect to clear errors and reset form when view changes
  useEffect(() => {
    form.reset();
  }, [view, form]);


  const handleGoogleSignIn = async () => {
    if (!auth) return;
    setIsLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      onOpenChange(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: t('auth.googleSignInFailed'),
        description: error.message || t('auth.unknownError'),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailAuth = async (data: FormValues) => {
    if (!auth || (view !== 'register' && !data.password)) return;
    setIsLoading(true);
    try {
      if (view === "login") {
        await signInWithEmailAndPassword(auth, data.email, data.password!);
      } else { // register
        const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password!);
        await updateProfile(userCredential.user, {
            displayName: data.displayName
        });
        if (userCredential.user) {
          await sendEmailVerification(userCredential.user);
          toast({
            title: t('auth.verification.emailSentTitle'),
            description: t('auth.verification.emailSentDescription')
          });
        }
      }
      onOpenChange(false);
      form.reset();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: view === "login" ? t('auth.loginFailed') : t('auth.registrationFailed'),
        description: error.message || t('auth.checkCredentials'),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async (data: FormValues) => {
    if (!auth) return;
    setIsLoading(true);
    try {
        await sendPasswordResetEmail(auth, data.email);
        toast({
            title: t('auth.reset.successTitle'),
            description: t('auth.reset.successDescription'),
        });
        setView('login');
    } catch (error: any) {
        toast({
            variant: "destructive",
            title: t('auth.reset.errorTitle'),
            description: error.message,
        });
    } finally {
        setIsLoading(false);
    }
  }

  const getDialogContent = () => {
    if (view === 'reset') {
        return (
            <div className="py-4">
                <p className="text-muted-foreground text-sm mb-4">{t('auth.reset.description')}</p>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handlePasswordReset)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('auth.email')}</FormLabel>
                                <FormControl>
                                <Input placeholder="name@example.com" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <Button type="submit" className="w-full" disabled={isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {t('auth.reset.button')}
                        </Button>
                    </form>
                </Form>
                <Button variant="link" className="w-full mt-2" onClick={() => setView('login')}>{t('auth.reset.backToLogin')}</Button>
            </div>
        );
    }

    return (
        <div className="py-4">
          <Tabs value={view} onValueChange={(value) => setView(value as 'login' | 'register')} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">{t('auth.login')}</TabsTrigger>
              <TabsTrigger value="register">{t('auth.register')}</TabsTrigger>
            </TabsList>
            <TabsContent value="login">
              <AuthForm form={form} onSubmit={handleEmailAuth} isLoading={isLoading} buttonText={t('auth.login')} view={view} onForgotPassword={() => setView('reset')} />
            </TabsContent>
            <TabsContent value="register">
              <AuthForm form={form} onSubmit={handleEmailAuth} isLoading={isLoading} buttonText={t('auth.createAccount')} view={view} />
            </TabsContent>
          </Tabs>
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                {t('auth.orContinueWith')}
              </span>
            </div>
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <svg className="mr-2 h-4 w-4" viewBox="0 0 48 48">
                <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
                <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z" />
                <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.222 0-9.61-3.317-11.28-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
                <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.021 35.846 44 30.138 44 24c0-1.341-.138-2.65-.389-3.917z" />
              </svg>
            )}
            Google
          </Button>
        </div>
    );
  }

  const getDialogTitle = () => {
    if (view === 'reset') return t('auth.reset.title');
    if (view === 'login') return t('auth.welcomeBack');
    return t('auth.createAccount');
  }

  const getDialogDescription = () => {
    if (view === 'reset') return '';
    if (view === 'login') return t('auth.signInToFavorites');
    return t('auth.signUpToFavorites');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl font-bold">
            {getDialogTitle()}
          </DialogTitle>
          {getDialogDescription() && (
            <DialogDescription className="text-center">
                {getDialogDescription()}
            </DialogDescription>
          )}
        </DialogHeader>
        {getDialogContent()}
      </DialogContent>
    </Dialog>
  );
}

interface AuthFormProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    form: any;
    onSubmit: (data: FormValues) => Promise<void>;
    isLoading: boolean;
    buttonText: string;
    view: 'login' | 'register';
    onForgotPassword?: () => void;
}

function AuthForm({ form, onSubmit, isLoading, buttonText, view, onForgotPassword }: AuthFormProps) {
  const { t } = useTranslation();
    return (
        <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
          {view === 'register' && (
            <FormField
                control={form.control}
                name="displayName"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>{t('auth.nickname')}</FormLabel>
                    <FormControl>
                    <Input placeholder={t('auth.nicknamePlaceholder')} {...field} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />
          )}
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('auth.email')}</FormLabel>
                <FormControl>
                  <Input placeholder="name@example.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('auth.password')}</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="••••••••" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {view === 'register' && (
            <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>{t('auth.confirmPassword')}</FormLabel>
                    <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />
          )}
           {view === 'login' && onForgotPassword && (
            <div className="flex justify-end">
              <Button
                type="button"
                variant="link"
                className="p-0 h-auto text-xs"
                onClick={onForgotPassword}
              >
                {t('auth.forgotPassword')}
              </Button>
            </div>
          )}
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {buttonText}
          </Button>
        </form>
      </Form>
    )
}
