import { Card, CardBody } from "@/components/ui/card";

export function SemPermissao() {
  return (
    <Card>
      <CardBody>
        <p className="text-ink text-sm font-medium">
          Você não tem permissão para ver esta tela.
        </p>
        <p className="text-ink-2 mt-1 text-sm">
          Peça ao administrador para ajustar o seu acesso.
        </p>
      </CardBody>
    </Card>
  );
}
