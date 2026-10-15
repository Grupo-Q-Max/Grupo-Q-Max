"use client";

import { Mail, Phone, Plus, Trash2, X } from "lucide-react";
import {
  CURRENCIES,
  DEAL_TYPES,
  RECURRENCES,
  SOURCES,
  emptyCompany,
  emptyContact,
  formatMoney,
  productsTotal,
  toDateInput,
  type DealCompany,
  type DealContact,
  type DealDetails,
  type DealDraft,
  type DealProduct,
  type TeamMember,
} from "./types";
import { Avatar, Field, LinkedBadge, LookupInput, Section } from "./ui";
import { Select } from "@/components/ui/Select";
import { DatePicker } from "@/components/ui/DatePicker";

type Props = {
  deal: DealDetails;
  draft: DealDraft;
  onChange: (changes: Partial<DealDraft>) => void;
  team: TeamMember[];
  onStageChange: (stageId: string) => void;
  onOpenProducts: () => void;
};

const UTM_LABELS: Record<string, string> = {
  source: "utm_source",
  medium: "utm_medium",
  campaign: "utm_campaign",
  content: "utm_content",
  term: "utm_term",
};

function ObserversField({ observers, team, onChange }: { observers: string[]; team: Props["team"]; onChange: Props["onChange"] }) {
  return (
    <Field label="Observadores">
      <div className="deal-chips">
        {observers.map((id) => {
          const member = team.find((m) => m.id === id);
          return (
            <span className="deal-chip" key={id}>
              <Avatar member={member} size={20} />
              {member?.name ?? "Membro removido"}
              <button
                type="button"
                title="Remover observador"
                onClick={() => onChange({ observers: observers.filter((o) => o !== id) })}
              >
                <X size={12} />
              </button>
            </span>
          );
        })}
        <Select
          className="deal-input deal-input--inline"
          value=""
          onChange={(e) => e.target.value && onChange({ observers: [...observers, e.target.value] })}
        >
          <option value="">+ Adicionar observador</option>
          {team
            .filter((m) => !observers.includes(m.id))
            .map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
        </Select>
      </div>
    </Field>
  );
}

function CustomFieldsSection({ deal, draft, onChange }: Pick<Props, "deal" | "draft" | "onChange">) {
  const customFields = deal.pipeline.fieldsConfig ?? [];
  if (customFields.length === 0) return null;
  return (
    <Section title="Campos adicionais">
      {customFields.map((field) => (
        <Field key={field.id} label={field.name} required={field.required}>
          <input
            className="deal-input"
            type={field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "phone" ? "tel" : "text"}
            value={draft.customData?.[field.id] ?? ""}
            onChange={(e) => onChange({ customData: { ...draft.customData, [field.id]: e.target.value } })}
          />
        </Field>
      ))}
    </Section>
  );
}

/** Task boards (pipeline kind TASKS): same card, only what an internal to-do needs. Checklist = activities in the timeline. */
function TaskGeneralForm({ deal, draft, onChange, team, onStageChange }: Props) {
  const responsible = team.find((m) => m.id === draft.responsibleId);
  return (
    <div className="deal-form">
      <Section title="Sobre a tarefa">
        <Field label="Nome" required>
          <input className="deal-input" value={draft.title} onChange={(e) => onChange({ title: e.target.value })} />
        </Field>
        <Field label="Coluna">
          <Select className="deal-input" value={deal.stageId} onChange={(e) => onStageChange(e.target.value)}>
            {deal.pipeline.stages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Prazo">
          <DatePicker
            className="deal-input deal-input--date"
            value={toDateInput(draft.closeDate)}
            onChange={(e) => onChange({ closeDate: e.target.value || null })}
          />
        </Field>
        <Field label="Responsável">
          <div className="deal-person">
            <Avatar member={responsible} size={36} />
            <Select
              className="deal-input"
              value={draft.responsibleId ?? ""}
              onChange={(e) => onChange({ responsibleId: e.target.value || null })}
            >
              <option value="">Sem responsável</option>
              {team.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name} — {member.role}
                </option>
              ))}
            </Select>
          </div>
        </Field>
        <Field label="Descrição">
          <textarea className="deal-input" rows={6} value={draft.comment ?? ""} onChange={(e) => onChange({ comment: e.target.value })} />
        </Field>
        <ObserversField observers={draft.observers} team={team} onChange={onChange} />
      </Section>
      <CustomFieldsSection deal={deal} draft={draft} onChange={onChange} />
    </div>
  );
}

export function DealGeneralForm(props: Props) {
  if (props.deal.pipeline.kind === "TASKS") return <TaskGeneralForm {...props} />;
  const { deal, draft, onChange, team, onStageChange, onOpenProducts } = props;
  const contacts = draft.contacts.length ? draft.contacts : [emptyContact()];
  const company = draft.company ?? emptyCompany();
  const observers = draft.observers;
  const products = draft.products;
  const hasProducts = products.length > 0;
  const responsible = team.find((m) => m.id === draft.responsibleId);
  const utmEntries = Object.entries(deal.utm ?? {}).filter(([, v]) => v);

  const updateContact = (index: number, changes: Partial<DealContact>) =>
    onChange({ contacts: contacts.map((c, i) => (i === index ? { ...c, ...changes } : c)) });

  const updateCompany = (changes: Partial<DealCompany>) => onChange({ company: { ...company, ...changes } });

  return (
    <div className="deal-form">
      <Section title="Sobre o negócio">
        <Field label="Nome" required>
          <input className="deal-input" value={draft.title} onChange={(e) => onChange({ title: e.target.value })} />
        </Field>

        <Field label="Etapa">
          <Select
            className="deal-input"
            value={deal.stageId}
            onChange={(e) => onStageChange(e.target.value)}
          >
            {deal.pipeline.stages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Valor e moeda"
          aside={hasProducts && <span className="deal-field__hint">calculado pelos serviços</span>}
        >
          <div className="deal-row">
            <input
              className="deal-input"
              type="number"
              step="0.01"
              min="0"
              disabled={hasProducts}
              value={draft.value}
              onChange={(e) => onChange({ value: Number(e.target.value) })}
            />
            <Select
              className="deal-input deal-input--narrow"
              value={draft.currency}
              onChange={(e) => onChange({ currency: e.target.value })}
            >
              {CURRENCIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>
        </Field>

        <Field label="Data de término">
          <DatePicker
            className="deal-input deal-input--date"
            value={toDateInput(draft.closeDate)}
            onChange={(e) => onChange({ closeDate: e.target.value || null })}
          />
        </Field>

        <div className="deal-subgroup">
          <span className="deal-subgroup__title">Cliente</span>

          {contacts.map((contact, index) => (
            <div className="deal-entity" key={contact.id ?? `new-${index}`}>
              <div className="deal-entity__header">
                <span>{index === 0 ? "Contato" : `Participante ${index}`}</span>
                <span className="deal-entity__tools">
                  {contact.id && <LinkedBadge onUnlink={() => updateContact(index, { id: undefined })} />}
                  {contacts.length > 1 && (
                    <button
                      type="button"
                      className="deal-icon-btn"
                      title="Remover do negócio"
                      onClick={() => onChange({ contacts: contacts.filter((_, i) => i !== index) })}
                    >
                      <X size={14} />
                    </button>
                  )}
                </span>
              </div>
              <LookupInput<Required<DealContact>>
                type="contact"
                placeholder="Nome do contato (busca contatos cadastrados)"
                value={contact.name}
                onChange={(name) => updateContact(index, { name })}
                onPick={(picked) => updateContact(index, picked)}
                describe={(c) => [c.phone, c.email].filter(Boolean).join(" · ")}
              />
              <Field label="Telefone" aside={contact.phone && <a href={`tel:${contact.phone}`} className="deal-field__link"><Phone size={12} /> ligar</a>}>
                <input
                  className="deal-input"
                  type="tel"
                  placeholder="+55"
                  value={contact.phone}
                  onChange={(e) => updateContact(index, { phone: e.target.value })}
                />
              </Field>
              <Field label="E-mail" aside={contact.email && <a href={`mailto:${contact.email}`} className="deal-field__link"><Mail size={12} /> enviar</a>}>
                <input
                  className="deal-input"
                  type="email"
                  value={contact.email}
                  onChange={(e) => updateContact(index, { email: e.target.value })}
                />
              </Field>
              <Field label="Endereço">
                <input
                  className="deal-input"
                  value={contact.address}
                  onChange={(e) => updateContact(index, { address: e.target.value })}
                />
              </Field>
              <Field label="Informações">
                <textarea
                  className="deal-input"
                  rows={2}
                  value={contact.info}
                  onChange={(e) => updateContact(index, { info: e.target.value })}
                />
              </Field>
            </div>
          ))}

          <button
            type="button"
            className="deal-link-btn"
            onClick={() => onChange({ contacts: [...contacts, emptyContact()] })}
          >
            <Plus size={14} /> Adicionar participante
          </button>

          <div className="deal-entity">
            <div className="deal-entity__header">
              <span>Empresa</span>
              {company.id && <LinkedBadge onUnlink={() => updateCompany({ id: undefined })} />}
            </div>
            <LookupInput<Required<DealCompany>>
              type="company"
              placeholder="Nome da empresa (busca por nome ou CNPJ)"
              value={company.name}
              onChange={(name) => updateCompany({ name })}
              onPick={(picked) => onChange({ company: picked })}
              describe={(c) => c.document}
            />
            {company.id && (
              <span className="deal-field__hint">Alterações nos dados da empresa valem para todos os negócios dela.</span>
            )}
            <Field label="CNPJ">
              <input
                className="deal-input"
                placeholder="00.000.000/0000-00"
                value={company.document}
                onChange={(e) => updateCompany({ document: e.target.value })}
              />
            </Field>
            <Field label="Telefone">
              <input
                className="deal-input"
                type="tel"
                placeholder="+55"
                value={company.phone}
                onChange={(e) => updateCompany({ phone: e.target.value })}
              />
            </Field>
            <Field label="E-mail">
              <input
                className="deal-input"
                type="email"
                value={company.email}
                onChange={(e) => updateCompany({ email: e.target.value })}
              />
            </Field>
            <Field label="Endereço">
              <input
                className="deal-input"
                value={company.address}
                onChange={(e) => updateCompany({ address: e.target.value })}
              />
            </Field>
            <Field label="Informações">
              <textarea
                className="deal-input"
                rows={2}
                value={company.info}
                onChange={(e) => updateCompany({ info: e.target.value })}
              />
            </Field>
          </div>
        </div>

        <Field label="Tipo de negócio">
          <input
            className="deal-input"
            list="deal-types"
            placeholder="Não selecionado"
            value={draft.dealType ?? ""}
            onChange={(e) => onChange({ dealType: e.target.value })}
          />
          <datalist id="deal-types">
            {DEAL_TYPES.map((type) => (
              <option key={type} value={type} />
            ))}
          </datalist>
        </Field>

        <Field label="Fonte">
          <Select className="deal-input" value={draft.source ?? ""} onChange={(e) => onChange({ source: e.target.value })}>
            <option value="">Não selecionado</option>
            {SOURCES.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Informações da fonte">
          <textarea
            className="deal-input"
            rows={3}
            value={draft.sourceInfo ?? ""}
            onChange={(e) => onChange({ sourceInfo: e.target.value })}
          />
        </Field>

        <Field label="Quem trouxe o lead">
          <input
            className="deal-input"
            list="deal-referrers"
            placeholder="Membro da equipe ou pessoa externa"
            maxLength={200}
            value={draft.referredBy ?? ""}
            onChange={(e) => onChange({ referredBy: e.target.value })}
          />
          <datalist id="deal-referrers">
            {team.map((member) => (
              <option key={member.id} value={member.name} />
            ))}
          </datalist>
        </Field>

        <label className="deal-checkbox">
          <input type="checkbox" checked={draft.isPublic} onChange={(e) => onChange({ isPublic: e.target.checked })} />
          Disponível para todos
        </label>

        <Field label="Responsável">
          <div className="deal-person">
            <Avatar member={responsible} size={36} />
            <Select
              className="deal-input"
              value={draft.responsibleId ?? ""}
              onChange={(e) => onChange({ responsibleId: e.target.value || null })}
            >
              <option value="">Sem responsável</option>
              {team.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name} — {member.role}
                </option>
              ))}
            </Select>
          </div>
        </Field>
      </Section>

      <CustomFieldsSection deal={deal} draft={draft} onChange={onChange} />

      <Section title="Mais">
        <Field label="Data de início">
          <DatePicker
            className="deal-input deal-input--date"
            value={toDateInput(draft.startDate)}
            onChange={(e) => onChange({ startDate: e.target.value || null })}
          />
        </Field>

        <ObserversField observers={observers} team={team} onChange={onChange} />

        <Field label="Comentário">
          <textarea
            className="deal-input"
            rows={5}
            value={draft.comment ?? ""}
            onChange={(e) => onChange({ comment: e.target.value })}
          />
        </Field>

        <Field label="Parâmetros UTM">
          {utmEntries.length === 0 ? (
            <span className="deal-readonly">Nenhum</span>
          ) : (
            <dl className="deal-utm">
              {utmEntries.map(([key, value]) => (
                <div key={key}>
                  <dt>{UTM_LABELS[key] ?? key}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </Field>
      </Section>

      <Section
        title="Serviços"
        action={
          <button type="button" className="deal-link-btn" onClick={onOpenProducts}>
            editar
          </button>
        }
      >
        {hasProducts ? (
          <>
            <p className="deal-readonly">
              {products.length} {products.length === 1 ? "item" : "itens"} por {formatMoney(draft.value, draft.currency)}
            </p>
            <ul className="deal-product-summary">
              {products.map((product) => (
                <li key={product.id}>
                  <strong>{product.name || "Serviço sem nome"}</strong>
                  <span>
                    {product.quantity} × {formatMoney(product.price, draft.currency)}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <button type="button" className="deal-link-btn" onClick={onOpenProducts}>
            <Plus size={14} /> Adicionar serviços
          </button>
        )}
      </Section>

      <Section title="Negócio recorrente">
        <Field
          label="Negócio recorrente"
          aside={draft.recurrence !== "NONE" && <span className="deal-field__hint">cria o próximo ao ganhar</span>}
        >
          <Select className="deal-input" value={draft.recurrence} onChange={(e) => onChange({ recurrence: e.target.value })}>
            {RECURRENCES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        </Field>
      </Section>
    </div>
  );
}

type CatalogProduct = { id: string; name: string; price: number };

export function DealProductsEditor({ draft, onChange }: { draft: DealDraft; onChange: (changes: Partial<DealDraft>) => void }) {
  const products = draft.products;

  const setProducts = (next: DealProduct[]) =>
    onChange({ products: next, ...(next.length > 0 && { value: productsTotal(next) }) });

  const update = (id: string, changes: Partial<DealProduct>) =>
    setProducts(products.map((p) => (p.id === id ? { ...p, ...changes } : p)));

  return (
    <div className="deal-products">
      <table className="deal-products__table">
        <thead>
          <tr>
            <th>Serviço</th>
            <th>Preço</th>
            <th>Quantidade</th>
            <th>Total</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.id}>
              <td>
                <LookupInput<CatalogProduct>
                  type="product"
                  placeholder="Nome do serviço (busca no catálogo)"
                  value={product.name}
                  // Typing a different name unlinks the catalog product; the API links/creates it on save
                  onChange={(name) => update(product.id, { name, productId: null })}
                  onPick={(picked) => update(product.id, { name: picked.name, price: picked.price, productId: picked.id })}
                  describe={(p) => formatMoney(p.price, draft.currency)}
                />
                <input
                  className="deal-input deal-products__description"
                  placeholder="Descrição (opcional)"
                  value={product.description ?? ""}
                  onChange={(e) => update(product.id, { description: e.target.value })}
                />
              </td>
              <td>
                <input
                  className="deal-input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={product.price}
                  onChange={(e) => update(product.id, { price: Number(e.target.value) })}
                />
              </td>
              <td>
                <input
                  className="deal-input"
                  type="number"
                  step="1"
                  min="0"
                  value={product.quantity}
                  onChange={(e) => update(product.id, { quantity: Number(e.target.value) })}
                />
              </td>
              <td className="deal-products__total">{formatMoney(product.price * product.quantity, draft.currency)}</td>
              <td>
                <button
                  type="button"
                  className="deal-icon-btn deal-icon-btn--danger"
                  title="Remover serviço"
                  onClick={() => setProducts(products.filter((p) => p.id !== product.id))}
                >
                  <Trash2 size={16} />
                </button>
              </td>
            </tr>
          ))}
          {products.length === 0 && (
            <tr>
              <td colSpan={5} className="deal-empty">
                Nenhum serviço. O valor do negócio pode ser informado manualmente na aba Geral.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="deal-products__footer">
        <button
          type="button"
          className="btn-secondary"
          onClick={() =>
            setProducts([
              ...products,
              { id: crypto.randomUUID(), productId: null, name: "", description: null, price: 0, quantity: 1 },
            ])
          }
        >
          <Plus size={16} /> Adicionar serviço
        </button>
        <div className="deal-products__sum">
          Total: <strong>{formatMoney(draft.value, draft.currency)}</strong>
        </div>
      </div>
    </div>
  );
}
