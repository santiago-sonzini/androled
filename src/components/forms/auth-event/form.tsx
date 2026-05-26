"use client";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
//import { login } from "~/app/actions/auth";
import { z } from "zod";
import { useState } from "react";
import { LoadingSpinner } from "@/components/loading";
import { loginToEvent } from "@/app/actions/event-auth";
import { redirect, useRouter } from "next/navigation";

export const formSchema = z.object({
  email: z.string().email({ message: "Ingresa un correo válido." }),
  password: z.string().min(3, {
    message: "El codigo debe tener al menos 3 caracteres.",
  }),
});

export type UserFormValue = z.infer<typeof formSchema>;

export default function LoginFormEvent() {
  const [error, setError] = useState<any>(null);
  const [loading, setLoading] = useState<any>(false);
  const router = useRouter();
  const form = useForm<UserFormValue>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: UserFormValue) => {
    console.log("🚀 ~ onSubmit ~ values:", values)
    setLoading(true);

    const res = await loginToEvent(values.email, values.password);
    
    console.log("🚀 ~ onSubmit ~ res:", res)
    if (res.status !== 200 || !res.event) {
      setError(res.error);
      setLoading(false);
    } else {
      router.push(`/admin`);
    }
  };

  return (
    <>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-2 w-full"
        >
          <FormField
            disabled={loading}
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="Enter your email..."
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            disabled={loading}
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="*********" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            disabled={loading}
            className="ml-auto w-full mt-6"
            type="submit"
          >
            {!loading ? "Sign In" : <LoadingSpinner />}
          </Button>
          <p className="mt-4 text-red-500 text-sm font-bold text-center">
            {error}
          </p>
        </form>
      </Form>
    </>
  );
}
