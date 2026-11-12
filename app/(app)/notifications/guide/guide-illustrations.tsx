import type { ReactNode } from "react";

function Phone({ label, children }: { label: string; children: ReactNode }) {
  return (
    <svg className="mx-auto h-auto w-full max-w-56" viewBox="0 0 200 260" role="img" aria-label={label}>
      <rect className="fill-muted stroke-border" x="4" y="4" width="192" height="252" rx="20" strokeWidth="2" />
      <rect className="fill-background" x="14" y="18" width="172" height="226" rx="8" />
      {children}
    </svg>
  );
}

function AddressBar() {
  return (
    <g>
      <rect className="fill-muted" x="22" y="26" width="132" height="20" rx="10" />
      <text className="fill-muted-foreground" x="34" y="40" fontSize="10">
        Quitô
      </text>
    </g>
  );
}

function MenuDots({ highlighted }: { highlighted: boolean }) {
  return (
    <g>
      {highlighted ? <circle className="fill-primary/20 stroke-primary" cx="170" cy="36" r="11" strokeWidth="2" /> : null}
      <circle className="fill-foreground" cx="170" cy="30" r="2" />
      <circle className="fill-foreground" cx="170" cy="36" r="2" />
      <circle className="fill-foreground" cx="170" cy="42" r="2" />
    </g>
  );
}

function MenuItem({ y, text, highlighted = false }: { y: number; text: string; highlighted?: boolean }) {
  return (
    <g>
      {highlighted ? <rect className="fill-primary/20 stroke-primary" x="78" y={y - 13} width="104" height="20" rx="4" strokeWidth="2" /> : null}
      <text className={highlighted ? "fill-foreground font-semibold" : "fill-muted-foreground"} x="86" y={y} fontSize="10">
        {text}
      </text>
    </g>
  );
}

function Dialog({ title, text, cancel, confirm }: { title: string; text: string; cancel: string; confirm: string }) {
  return (
    <g>
      <rect className="fill-foreground/30" x="14" y="18" width="172" height="226" rx="8" />
      <rect className="fill-background stroke-border" x="26" y="88" width="148" height="104" rx="10" strokeWidth="1.5" />
      <rect className="fill-primary" x="38" y="100" width="22" height="22" rx="5" />
      <text className="fill-primary-foreground font-semibold" x="44" y="116" fontSize="13">
        Q
      </text>
      <text className="fill-foreground font-semibold" x="68" y="115" fontSize="11">
        {title}
      </text>
      <text className="fill-muted-foreground" x="38" y="144" fontSize="9">
        {text}
      </text>
      <text className="fill-muted-foreground" x="74" y="176" fontSize="10">
        {cancel}
      </text>
      <rect className="fill-primary/20 stroke-primary" x="112" y="163" width="56" height="20" rx="4" strokeWidth="2" />
      <text className="fill-primary font-semibold" x="120" y="177" fontSize="10">
        {confirm}
      </text>
    </g>
  );
}

export function ChromeMenuImage() {
  return (
    <Phone label="Chrome com os três pontinhos e a opção Instalar app destacadas">
      <AddressBar />
      <MenuDots highlighted />
      <rect className="fill-background stroke-border" x="72" y="52" width="116" height="104" rx="6" strokeWidth="1.5" />
      <MenuItem y={72} text="Nova guia" />
      <MenuItem y={94} text="Favoritos" />
      <MenuItem y={116} text="Instalar app" highlighted />
      <MenuItem y={138} text="Configurações" />
    </Phone>
  );
}

export function InstallDialogImage() {
  return (
    <Phone label="Pergunta do Chrome para instalar o Quitô, com o botão Instalar destacado">
      <AddressBar />
      <MenuDots highlighted={false} />
      <Dialog title="Instalar app?" text="Quitô" cancel="Cancelar" confirm="Instalar" />
    </Phone>
  );
}

export function PermissionDialogImage() {
  return (
    <Phone label="Pergunta do celular para o Quitô enviar notificações, com o botão Permitir destacado">
      <AddressBar />
      <MenuDots highlighted={false} />
      <Dialog title="Notificações" text="Permitir que o Quitô envie?" cancel="Não" confirm="Permitir" />
    </Phone>
  );
}

export function SiteSettingsImage() {
  return (
    <Phone label="Ajustes do Quitô no Chrome, com a chave de Notificações destacada">
      <AddressBar />
      <circle className="fill-primary/20 stroke-primary" cx="34" cy="36" r="9" strokeWidth="2" />
      <rect className="fill-background stroke-border" x="22" y="56" width="156" height="92" rx="6" strokeWidth="1.5" />
      <text className="fill-foreground font-semibold" x="32" y="76" fontSize="10">
        Quitô
      </text>
      <text className="fill-muted-foreground" x="32" y="100" fontSize="10">
        Local
      </text>
      <rect className="fill-primary/20 stroke-primary" x="26" y="114" width="148" height="24" rx="4" strokeWidth="2" />
      <text className="fill-foreground font-semibold" x="32" y="130" fontSize="10">
        Notificações
      </text>
      <rect className="fill-primary" x="140" y="120" width="26" height="12" rx="6" />
      <circle className="fill-primary-foreground" cx="160" cy="126" r="5" />
    </Phone>
  );
}

export function TestNotificationImage() {
  return (
    <Phone label="Notificação de teste do Quitô chegando no alto da tela">
      <rect className="fill-muted stroke-primary" x="22" y="28" width="156" height="58" rx="10" strokeWidth="2" />
      <rect className="fill-primary" x="30" y="38" width="18" height="18" rx="4" />
      <text className="fill-primary-foreground font-semibold" x="35" y="51" fontSize="11">
        Q
      </text>
      <text className="fill-foreground font-semibold" x="56" y="50" fontSize="10">
        Quitô
      </text>
      <text className="fill-muted-foreground" x="30" y="72" fontSize="8">
        Notificação de teste
      </text>
      <rect className="fill-muted" x="40" y="112" width="120" height="10" rx="5" />
      <rect className="fill-muted" x="40" y="132" width="90" height="10" rx="5" />
    </Phone>
  );
}

function QuitoIcon({ x, y, size }: { x: number; y: number; size: number }) {
  return (
    <g>
      <rect className="fill-primary" x={x} y={y} width={size} height={size} rx={size / 4} />
      <text className="fill-primary-foreground font-semibold" x={x + size / 2} y={y + size * 0.7} fontSize={size * 0.6} textAnchor="middle">
        Q
      </text>
    </g>
  );
}

function SafariBottomBar({ share }: { share: boolean }) {
  return (
    <g>
      <rect className="fill-muted" x="14" y="206" width="172" height="38" />
      <rect className="fill-background stroke-border" x="24" y="212" width="112" height="22" rx="11" strokeWidth="1" />
      <text className="fill-muted-foreground" x="38" y="227" fontSize="10">
        Quitô
      </text>
      {share ? <circle className="fill-primary/20 stroke-primary" cx="160" cy="223" r="13" strokeWidth="2" /> : null}
      <rect className="fill-none stroke-foreground" x="153" y="220" width="14" height="12" rx="2" strokeWidth="1.5" />
      <path className="stroke-foreground" d="M160 212 V226 M155 217 L160 212 L165 217" fill="none" strokeWidth="1.5" />
    </g>
  );
}

function SheetItem({ y, text, highlighted = false }: { y: number; text: string; highlighted?: boolean }) {
  return (
    <g>
      {highlighted ? <rect className="fill-primary/20 stroke-primary" x="22" y={y - 14} width="156" height="22" rx="4" strokeWidth="2" /> : null}
      <text className={highlighted ? "fill-foreground font-semibold" : "fill-muted-foreground"} x="32" y={y} fontSize="10">
        {text}
      </text>
    </g>
  );
}

export function SafariShareImage() {
  return (
    <Phone label="Safari com o botão Compartilhar destacado na barra de baixo">
      <rect className="fill-muted" x="40" y="60" width="120" height="10" rx="5" />
      <rect className="fill-muted" x="40" y="80" width="90" height="10" rx="5" />
      <SafariBottomBar share />
    </Phone>
  );
}

export function ShareSheetImage() {
  return (
    <Phone label="Lista do Compartilhar no Safari, com a opção Adicionar à Tela de Início destacada">
      <rect className="fill-foreground/30" x="14" y="18" width="172" height="226" rx="8" />
      <rect className="fill-background stroke-border" x="14" y="96" width="172" height="148" rx="10" strokeWidth="1.5" />
      <QuitoIcon x={26} y={108} size={22} />
      <text className="fill-foreground font-semibold" x="56" y="123" fontSize="11">
        Quitô
      </text>
      <SheetItem y={160} text="Copiar" />
      <SheetItem y={184} text="Adicionar aos Favoritos" />
      <SheetItem y={208} text="Adicionar à Tela de Início" highlighted />
      <SheetItem y={232} text="Editar Ações..." />
    </Phone>
  );
}

export function AddToHomeImage() {
  return (
    <Phone label="Tela Adicionar à Tela de Início, com Abrir como App da Web ligado e o botão Adicionar destacado">
      <text className="fill-muted-foreground" x="24" y="40" fontSize="10">
        Cancelar
      </text>
      <rect className="fill-primary/20 stroke-primary" x="130" y="27" width="50" height="20" rx="4" strokeWidth="2" />
      <text className="fill-primary font-semibold" x="136" y="41" fontSize="10">
        Adicionar
      </text>
      <rect className="fill-muted stroke-border" x="22" y="60" width="156" height="50" rx="8" strokeWidth="1" />
      <QuitoIcon x={30} y={68} size={34} />
      <text className="fill-foreground font-semibold" x="74" y="90" fontSize="11">
        Quitô
      </text>
      <rect className="fill-muted stroke-border" x="22" y="122" width="156" height="28" rx="8" strokeWidth="1" />
      <text className="fill-foreground" x="30" y="140" fontSize="9">
        Abrir como App da Web
      </text>
      <rect className="fill-primary" x="144" y="129" width="26" height="14" rx="7" />
      <circle className="fill-primary-foreground" cx="163" cy="136" r="5" />
    </Phone>
  );
}

export function HomeScreenImage() {
  const others = [
    [30, 40],
    [72, 40],
    [114, 40],
    [156, 40],
    [30, 92],
    [72, 92],
  ];
  return (
    <Phone label="Tela de início do iPhone com o ícone do Quitô destacado">
      {others.map(([x, y]) => (
        <rect key={`${x}-${y}`} className="fill-muted" x={x - 14} y={y} width="28" height="28" rx="7" />
      ))}
      <circle className="fill-primary/20 stroke-primary" cx="114" cy="110" r="24" strokeWidth="2" />
      <QuitoIcon x={100} y={92} size={28} />
      <text className="fill-foreground font-semibold" x="114" y="132" fontSize="8" textAnchor="middle">
        Quitô
      </text>
    </Phone>
  );
}

export function IphonePermissionImage() {
  return (
    <Phone label="Pergunta do iPhone para o Quitô enviar notificações, com o botão Permitir destacado">
      <rect className="fill-foreground/30" x="14" y="18" width="172" height="226" rx="8" />
      <rect className="fill-background stroke-border" x="30" y="82" width="140" height="104" rx="12" strokeWidth="1.5" />
      <text className="fill-foreground font-semibold" x="100" y="106" fontSize="10" textAnchor="middle">
        “Quitô” deseja enviar
      </text>
      <text className="fill-foreground font-semibold" x="100" y="120" fontSize="10" textAnchor="middle">
        notificações
      </text>
      <line className="stroke-border" x1="30" y1="146" x2="170" y2="146" strokeWidth="1" />
      <line className="stroke-border" x1="100" y1="146" x2="100" y2="186" strokeWidth="1" />
      <text className="fill-muted-foreground" x="65" y="170" fontSize="9" textAnchor="middle">
        Não Permitir
      </text>
      <rect className="fill-primary/20 stroke-primary" x="108" y="154" width="56" height="24" rx="4" strokeWidth="2" />
      <text className="fill-primary font-semibold" x="136" y="170" fontSize="10" textAnchor="middle">
        Permitir
      </text>
    </Phone>
  );
}

export function IphoneSettingsImage() {
  return (
    <Phone label="Ajustes do iPhone em Notificações, Quitô, com a chave Permitir Notificações destacada">
      <text className="fill-muted-foreground" x="24" y="40" fontSize="9">
        Ajustes › Notificações
      </text>
      <QuitoIcon x={24} y={52} size={24} />
      <text className="fill-foreground font-semibold" x="56" y="69" fontSize="11">
        Quitô
      </text>
      <rect className="fill-primary/20 stroke-primary" x="22" y="92" width="156" height="28" rx="4" strokeWidth="2" />
      <text className="fill-foreground font-semibold" x="30" y="110" fontSize="9">
        Permitir Notificações
      </text>
      <rect className="fill-primary" x="144" y="99" width="26" height="14" rx="7" />
      <circle className="fill-primary-foreground" cx="163" cy="106" r="5" />
      <rect className="fill-muted" x="22" y="134" width="156" height="12" rx="6" />
      <rect className="fill-muted" x="22" y="154" width="120" height="12" rx="6" />
    </Phone>
  );
}
