import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RegisterForm } from "@/components/auth/RegisterForm";

export default function RegisterPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Załóż konto</CardTitle>
        <CardDescription>Zaczynasz z pustą, prywatną grupą „Moja”.</CardDescription>
      </CardHeader>
      <CardContent>
        <RegisterForm />
      </CardContent>
    </Card>
  );
}
