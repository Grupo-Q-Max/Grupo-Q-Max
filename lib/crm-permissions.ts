/**
 * CRM permissions a group may grant (CrmGroupPermission.permission). Shared by the
 * server checks (lib/crm-access.ts) and the UI. A new CRM action = a new key here,
 * a `denyUnless` in its route and `useCan` where its button is shown.
 */
export const PERMISSION_SECTIONS = [
  {
    label: "Pipelines e etapas",
    permissions: {
      "pipeline.create": "Criar pipelines",
      "pipeline.edit": "Editar pipelines (nome e campos personalizados)",
      "stage.create": "Criar etapas",
      "stage.edit": "Renomear etapas",
      "stage.delete": "Excluir etapas",
    },
  },
  {
    label: "Negócios",
    permissions: {
      "deal.create": "Criar negócios",
      "deal.edit": "Editar, mover e fechar negócios",
      "deal.delete": "Excluir negócios",
    },
  },
  {
    label: "Atividades",
    permissions: {
      "activity.create": "Criar atividades e comentários",
      "activity.edit": "Editar e concluir atividades",
      "activity.delete": "Excluir atividades e comentários",
    },
  },
  {
    label: "Automações",
    permissions: {
      "automation.view": "Ver regras de automação, gatilhos e registros",
      "automation.create": "Criar regras de automação",
      "automation.edit": "Editar e reordenar regras de automação",
      "automation.delete": "Excluir regras de automação",
      "trigger.create": "Criar gatilhos",
      "trigger.edit": "Editar e reordenar gatilhos",
      "trigger.delete": "Excluir gatilhos",
    },
  },
  {
    label: "Serviços",
    permissions: {
      "product.manage": "Cadastrar, editar e excluir serviços do catálogo",
    },
  },
  {
    label: "Relatórios",
    permissions: {
      "report.view": "Ver relatórios de negócios ganhos e perdidos",
    },
  },
  {
    label: "Administração",
    permissions: {
      "access.manage": "Gerenciar grupos, permissões e o grupo de cada usuário",
      "request.manage": "Ver todos os pedidos de melhoria e alterar o status",
    },
  },
] as const;

type KeysOfUnion<T> = T extends T ? keyof T : never;
export type Permission = KeysOfUnion<(typeof PERMISSION_SECTIONS)[number]["permissions"]>;

export const ALL_PERMISSIONS = PERMISSION_SECTIONS.flatMap((s) => Object.keys(s.permissions)) as Permission[];

const known = new Set<string>(ALL_PERMISSIONS);
export const isPermission = (value: unknown): value is Permission => typeof value === "string" && known.has(value);

/** What the "Usuários" group gets when the groups are first created. */
export const DEFAULT_USER_PERMISSIONS: Permission[] = [
  "deal.create",
  "deal.edit",
  "activity.create",
  "activity.edit",
  "activity.delete",
  "automation.view",
];
