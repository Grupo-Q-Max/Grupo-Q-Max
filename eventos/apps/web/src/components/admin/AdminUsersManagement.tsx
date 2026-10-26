"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  UserPlus,
  Shield,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  CheckCircle2,
  XCircle,
  LoaderCircle,
  X,
  UserRound,
  Mail,
  Lock,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import { fetchAdminProxy } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";

type AdminUser = {
  id: number;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "ADMIN" | "OPERATOR" | "VIEWER";
  active: boolean;
  last_login_at: string | null;
  created_at: string;
};

type Props = {
  initialUsers: AdminUser[];
};

export default function AdminUsersManagement({ initialUsers }: Props) {
  const toast = useToast();
  const [users, setUsers] = useState<AdminUser[]>(initialUsers);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal Criar Admin
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"ADMIN" | "OPERATOR" | "SUPER_ADMIN">("ADMIN");
  const [creating, setCreating] = useState(false);

  // Modal Alterar Senha
  const [resettingUser, setResettingUser] = useState<AdminUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const reloadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchAdminProxy("/admin-users", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setUsers(Array.isArray(data) ? data : []);
      }
    } catch {
      toast.error("Erro ao carregar lista de administradores.", "Falha na requisição");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    reloadUsers();
  }, [reloadUsers]);

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const q = searchQuery.toLowerCase().trim();
    return users.filter(
      (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  }, [users, searchQuery]);

  async function handleCreateAdmin(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password) {
      toast.error("Preencha todos os campos obrigatórios.", "Atenção");
      return;
    }

    setCreating(true);
    try {
      const res = await fetchAdminProxy("/admin-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password, role }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Erro ao criar administrador.");
      }

      toast.success(`Administrador "${name.trim()}" criado com sucesso!`, "Admin Cadastrado");
      setShowCreateModal(false);
      setName("");
      setEmail("");
      setPassword("");
      await reloadUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao cadastrar.", "Falha");
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleActive(user: AdminUser) {
    try {
      const res = await fetchAdminProxy(`/admin-users/${user.id}/toggle-active`, {
        method: "PATCH",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Erro ao alterar status.");
      }

      toast.success(
        `Administrador ${user.name} foi ${data.active ? "ativado" : "desativado"}.`,
        "Status Atualizado",
      );
      await reloadUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar status.", "Falha");
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resettingUser || !newPassword || newPassword.length < 6) {
      toast.error("A nova senha deve ter no mínimo 6 caracteres.", "Atenção");
      return;
    }

    setSavingPassword(true);
    try {
      const res = await fetchAdminProxy(`/admin-users/${resettingUser.id}/reset-password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Erro ao redefinir senha.");
      }

      toast.success(`Senha de ${resettingUser.name} redefinida com sucesso!`, "Senha Alterada");
      setResettingUser(null);
      setNewPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao redefinir.", "Falha");
    } finally {
      setSavingPassword(false);
    }
  }

  function getRoleBadge(userRole: string) {
    switch (userRole) {
      case "SUPER_ADMIN":
        return (
          <span className="px-3 py-1 rounded-xl text-xs font-black bg-[#FFF3DC] text-[#8A4B00] border border-[#F2D19B] flex items-center gap-1.5">
            <ShieldCheck size={13} className="text-[#8A4B00]" /> SUPER ADMIN
          </span>
        );
      case "ADMIN":
        return (
          <span className="px-3 py-1 rounded-xl text-xs font-black bg-[#E6F0FF] text-finora-600 border border-[#B9D4F7] flex items-center gap-1.5">
            <Shield size={13} className="text-finora-600" /> ADMIN
          </span>
        );
      case "OPERATOR":
        return (
          <span className="px-3 py-1 rounded-xl text-xs font-black bg-[#E3F6EA] text-[#0F7A3D] border border-[#B7E4C7] flex items-center gap-1.5">
            <UserRound size={13} className="text-[#0F7A3D]" /> OPERADOR
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 rounded-xl text-xs font-bold bg-[#EEF1F5] text-text border border-line-strong">
            {userRole}
          </span>
        );
    }
  }

  return (
    <div className="w-full space-y-6 text-text font-sans">
      {/* Barra de Ações Superior */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-surface border-2 border-line p-6 sm:p-8 rounded-3xl">
        <div>
          <span className="text-xs font-black text-finora-600 uppercase tracking-wider flex items-center gap-1.5 mb-1">
            <ShieldCheck size={15} /> SEGURANÇA & ACESSO
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-text">
            Gestão de Administradores
          </h2>
          <p className="text-xs sm:text-sm text-text mt-1 font-medium">
            Gerencie os usuários autorizados a operar o painel, balcão e sorteios.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-stretch sm:self-auto">
          <button
            type="button"
            onClick={reloadUsers}
            disabled={loading}
            className="p-3 rounded-2xl bg-[#EEF1F5] border border-line-strong text-text hover:text-text hover:bg-line-strong transition"
            title="Atualizar lista de administradores"
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          </button>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-finora-600 hover:bg-finora-700 text-white font-black text-xs sm:text-sm transition-all active:scale-95"
          >
            <UserPlus size={18} />
            <span>Criar Novo Administrador</span>
          </button>
        </div>
      </div>

      {/* Barra de Busca e Estatísticas */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome ou e-mail..."
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-surface border border-line text-text text-xs font-medium focus:outline-none focus:border-finora-600 transition"
          />
        </div>

        <span className="text-xs font-bold text-text">
          Total: <strong className="text-text font-black">{filteredUsers.length}</strong> de <strong className="text-text font-black">{users.length}</strong> administradores
        </span>
      </div>

      {/* Tabela de Administradores */}
      <div className="bg-surface border-2 border-line rounded-3xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-paper border-b border-line text-text font-black uppercase tracking-wider text-[11px]">
                <th className="p-4 sm:p-5">Administrador</th>
                <th className="p-4 sm:p-5">E-mail / Usuário</th>
                <th className="p-4 sm:p-5 text-center">Perfil</th>
                <th className="p-4 sm:p-5 text-center">Status</th>
                <th className="p-4 sm:p-5 text-center">Último Acesso</th>
                <th className="p-4 sm:p-5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {loading && users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-text">
                    <LoaderCircle size={28} className="animate-spin text-finora-600 mx-auto mb-2" />
                    <span>Carregando administradores...</span>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-text">
                    <Users size={36} className="mx-auto text-[#7A8597] mb-3" />
                    <p className="font-bold text-base text-text mb-1">
                      {searchQuery ? "Nenhum administrador encontrado para a busca." : "Nenhum administrador cadastrado."}
                    </p>
                    <p className="text-xs text-text-2 max-w-sm mx-auto mb-4">
                      Clique no botão abaixo para adicionar o primeiro administrador ao sistema.
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(true)}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-finora-600 hover:bg-finora-700 text-white font-bold text-xs transition"
                    >
                      <UserPlus size={15} />
                      <span>Criar Administrador</span>
                    </button>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-paper transition-colors">
                    <td className="p-4 sm:p-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-[#E6F0FF] border border-[#B9D4F7] flex items-center justify-center text-finora-600 font-black text-sm shrink-0">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <strong className="text-sm font-black text-text block leading-tight">
                            {u.name}
                          </strong>
                          <span className="text-[11px] font-bold text-text-2">
                            ID #{u.id}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 sm:p-5 font-mono text-text font-bold text-xs">
                      {u.email}
                    </td>
                    <td className="p-4 sm:p-5 text-center">
                      <div className="inline-flex justify-center">
                        {getRoleBadge(u.role)}
                      </div>
                    </td>
                    <td className="p-4 sm:p-5 text-center">
                      {u.active ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-black text-[#0F7A3D] bg-[#E3F6EA] border border-[#B7E4C7] px-3 py-1 rounded-full">
                          <CheckCircle2 size={13} className="text-[#0F7A3D]" /> Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-black text-[#A3112F] bg-[#FDE8EC] border border-[#F5C2CD] px-3 py-1 rounded-full">
                          <XCircle size={13} className="text-[#A3112F]" /> Inativo
                        </span>
                      )}
                    </td>
                    <td className="p-4 sm:p-5 text-center text-text font-mono text-xs font-medium">
                      {u.last_login_at
                        ? new Date(u.last_login_at).toLocaleString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "Nunca acessou"}
                    </td>
                    <td className="p-4 sm:p-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setResettingUser(u);
                            setNewPassword("");
                          }}
                          className="px-3.5 py-2 rounded-full bg-[#EEF1F5] hover:bg-line-strong text-text text-xs font-bold border border-line-strong transition flex items-center gap-1.5"
                          title="Alterar senha deste administrador"
                        >
                          <KeyRound size={13} className="text-[#8A4B00]" />
                          <span>Senha</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleActive(u)}
                          className={`px-3.5 py-2 rounded-full text-xs font-bold border transition ${
                            u.active
                              ? "bg-[#FDE8EC] hover:bg-[#FAD4DC] text-[#A3112F] border-[#F5C2CD]"
                              : "bg-[#E3F6EA] hover:bg-[#D2EFDC] text-[#0F7A3D] border-[#B7E4C7]"
                          }`}
                        >
                          {u.active ? "Desativar" : "Ativar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Criar Novo Administrador */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-text/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-line p-6 md:p-8 rounded-3xl max-w-md w-full animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-line mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-[#E6F0FF] border border-[#B9D4F7] flex items-center justify-center text-finora-600">
                  <UserPlus size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-text">Novo Administrador</h3>
                  <span className="text-xs text-text-2">Acesso ao Finora Experience</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-text-2 hover:text-text p-1"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateAdmin} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-text-2 block mb-1.5">
                  Nome Completo
                </label>
                <div className="relative">
                  <UserRound size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-2" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Dr. Rodrigo Penhalves"
                    required
                    className="w-full bg-surface border border-line focus:border-finora-600 rounded-xl py-2.5 pl-10 pr-3.5 text-xs text-text outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-text-2 block mb-1.5">
                  E-mail / Usuário de Acesso
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-2" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@clinica.com.br"
                    required
                    className="w-full bg-surface border border-line focus:border-finora-600 rounded-xl py-2.5 pl-10 pr-3.5 text-xs text-text outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-text-2 block mb-1.5">
                  Senha de Acesso
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-2" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    required
                    minLength={6}
                    className="w-full bg-surface border border-line focus:border-finora-600 rounded-xl py-2.5 pl-10 pr-3.5 text-xs text-text outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-text-2 block mb-1.5">
                  Perfil de Permissão
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full bg-surface border border-line focus:border-finora-600 rounded-xl py-2.5 px-3.5 text-xs text-text outline-none"
                >
                  <option value="ADMIN">ADMIN (Acesso Geral)</option>
                  <option value="SUPER_ADMIN">SUPER ADMIN (Acesso Total + Gestão de Usuários)</option>
                  <option value="OPERATOR">OPERADOR (Apenas Balcão e Roleta)</option>
                </select>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-3 rounded-xl bg-[#EEF1F5] hover:bg-line-strong text-xs font-bold text-text transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 py-3 rounded-xl bg-finora-600 hover:bg-finora-700 text-xs font-bold text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {creating ? <LoaderCircle size={15} className="animate-spin" /> : <UserPlus size={15} />}
                  <span>Salvar Administrador</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Redefinir Senha */}
      {resettingUser && (
        <div className="fixed inset-0 z-50 bg-text/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-line p-6 rounded-3xl max-w-sm w-full animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-line mb-4">
              <div className="flex items-center gap-2">
                <KeyRound size={18} className="text-[#8A4B00]" />
                <h3 className="text-base font-bold text-text">Alterar Senha</h3>
              </div>
              <button
                type="button"
                onClick={() => setResettingUser(null)}
                className="text-text-2 hover:text-text"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-text-2 mb-4">
              Defina a nova senha para o administrador <strong>{resettingUser.name}</strong> ({resettingUser.email}):
            </p>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-text-2 block mb-1.5">
                  Nova Senha
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nova senha (mín. 6 dígitos)"
                  required
                  minLength={6}
                  autoFocus
                  className="w-full bg-surface border border-line focus:border-finora-600 rounded-xl py-2.5 px-3.5 text-xs text-text outline-none"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setResettingUser(null)}
                  className="flex-1 py-2.5 rounded-xl bg-[#EEF1F5] text-xs font-bold text-text"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingPassword}
                  className="flex-1 py-2.5 rounded-xl bg-finora-600 hover:bg-finora-700 text-xs font-bold text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {savingPassword ? <LoaderCircle size={14} className="animate-spin" /> : <KeyRound size={14} />}
                  <span>Salvar Senha</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
