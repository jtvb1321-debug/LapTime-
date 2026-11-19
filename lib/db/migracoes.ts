// Migrações do banco, em ordem. Cada uma roda uma única vez, dentro de uma
// transação (ver lib/db/migrar.ts). NUNCA edite uma migração já aplicada —
// crie uma nova. O SQL fica aqui (e não em .sql) pra ir junto no build
// standalone do Next sem configuração extra.
export interface Migracao {
  id: string;
  sql: string;
  // true = migração estrutural (módulo do campeonato em diante). NÃO é aplicada
  // sozinha na subida do servidor: só em banco de desenvolvimento liberado pela
  // proteção (lib/db/protecao-migracao.ts). As 15 migrações existentes não são
  // estruturais e continuam automáticas.
  estrutural?: boolean;
}

export const MIGRACOES: Migracao[] = [
  {
    id: "0001_base",
    sql: `
      create table perfil (
        id text primary key,
        user_id text not null,
        nome text not null,
        email text not null,
        papel text not null
          check (papel in ('admin', 'fiscal', 'operador', 'piloto')),
        piloto_id text,
        avatar_url text,
        senha_hash text,
        ativo boolean not null default true,
        criado_em timestamptz not null default clock_timestamp()
      );
      create unique index perfil_email_unico on perfil (lower(email));

      create table piloto (
        id text primary key,
        nome text not null,
        apelido text,
        slug text not null unique,
        numero integer not null,
        categoria_id text not null,
        cidade text,
        uf text,
        avatar_url text,
        idade integer,
        peso_kg numeric,
        cor_numero text,
        cor_assinatura text,
        vitorias integer not null default 0,
        podios integer not null default 0,
        pontos integer not null default 0,
        posicao_campeonato integer not null default 0,
        criado_em timestamptz not null default clock_timestamp()
      );
      create index piloto_numero on piloto (numero);

      create table patrocinador (
        id text primary key,
        nome text not null,
        logo_url text,
        ativo boolean not null default true,
        ordem integer not null default 0
      );

      create table sessao (
        id uuid primary key default gen_random_uuid(),
        token_hash text not null unique,
        perfil_id text not null references perfil (id) on delete cascade,
        criada_em timestamptz not null default now(),
        expira_em timestamptz not null,
        ultimo_uso timestamptz not null default now(),
        ip text,
        user_agent text,
        revogada_em timestamptz
      );
      create index sessao_perfil on sessao (perfil_id);

      create table audit_log (
        id bigserial primary key,
        criado_em timestamptz not null default now(),
        usuario_id text,
        acao text not null,
        entidade text not null,
        entidade_id text,
        antes jsonb,
        depois jsonb,
        motivo text,
        ip text
      );
      create index audit_log_busca on audit_log (acao, entidade_id, criado_em);

      create function audit_log_imutavel() returns trigger
      language plpgsql as $$
      begin
        raise exception 'audit_log é somente de inclusão (append-only)';
      end;
      $$;
      create trigger audit_log_sem_alteracao
        before update or delete on audit_log
        for each row execute function audit_log_imutavel();

      create table importacao_json (
        arquivo text primary key,
        importado_em timestamptz not null default now(),
        linhas integer not null
      );
    `,
  },
  {
    // Operação do kartódromo: clientes, grade de baterias, reservas e caixa.
    // Valores sempre em centavos (inteiros). Movimentos de caixa são
    // imutáveis: erro de lançamento se corrige com estorno, nunca com UPDATE.
    id: "0002_operacao",
    sql: `
      alter table perfil drop constraint perfil_papel_check;
      alter table perfil add constraint perfil_papel_check
        check (papel in ('admin', 'fiscal', 'operador', 'recepcao', 'piloto'));

      create table cliente (
        id text primary key,
        nome text not null,
        telefone text not null,
        telefone_digitos text not null,
        email text,
        documento text,
        criado_em timestamptz not null default clock_timestamp()
      );
      create index cliente_telefone on cliente (telefone_digitos);
      create index cliente_nome on cliente (lower(nome));

      create table bateria_slot (
        id text primary key,
        inicio timestamptz not null unique,
        duracao_min integer not null check (duracao_min > 0),
        capacidade integer not null check (capacidade > 0),
        preco_centavos integer not null check (preco_centavos >= 0),
        cancelada_em timestamptz,
        criado_em timestamptz not null default clock_timestamp()
      );

      create table reserva (
        id text primary key,
        slot_id text not null references bateria_slot (id),
        cliente_id text not null references cliente (id),
        pilotos integer not null check (pilotos > 0),
        desconto_centavos integer not null default 0 check (desconto_centavos >= 0),
        valor_centavos integer not null check (valor_centavos >= 0),
        status text not null default 'reservada'
          check (status in ('reservada', 'cancelada')),
        criada_por text,
        cancelada_em timestamptz,
        cancelada_por text,
        motivo_cancelamento text,
        criado_em timestamptz not null default clock_timestamp()
      );
      create index reserva_slot on reserva (slot_id);
      create index reserva_cliente on reserva (cliente_id);

      create table caixa (
        id text primary key,
        aberto_em timestamptz not null default clock_timestamp(),
        aberto_por text,
        fundo_centavos integer not null check (fundo_centavos >= 0),
        fechado_em timestamptz,
        fechado_por text,
        esperado_dinheiro_centavos integer,
        contado_dinheiro_centavos integer,
        diferenca_centavos integer,
        observacao text
      );
      -- No máximo UM caixa aberto por vez.
      create unique index caixa_um_aberto on caixa ((true)) where fechado_em is null;

      create table caixa_movimento (
        id bigserial primary key,
        caixa_id text not null references caixa (id),
        tipo text not null
          check (tipo in ('pagamento', 'estorno', 'suprimento', 'sangria')),
        forma text not null check (forma in ('dinheiro', 'pix', 'cartao')),
        valor_centavos integer not null check (valor_centavos > 0),
        reserva_id text references reserva (id),
        estorno_de bigint references caixa_movimento (id),
        descricao text,
        criado_por text,
        criado_em timestamptz not null default clock_timestamp(),
        check (tipo in ('pagamento', 'estorno') or forma = 'dinheiro'),
        check (tipo in ('pagamento', 'estorno') = (reserva_id is not null)),
        check ((tipo = 'estorno') = (estorno_de is not null))
      );
      create index caixa_movimento_caixa on caixa_movimento (caixa_id);
      create index caixa_movimento_reserva on caixa_movimento (reserva_id);
      -- Um pagamento só pode ser estornado uma vez.
      create unique index caixa_movimento_estorno_unico
        on caixa_movimento (estorno_de) where estorno_de is not null;

      create function caixa_movimento_imutavel() returns trigger
      language plpgsql as $$
      begin
        raise exception 'caixa_movimento é somente de inclusão: corrija com estorno';
      end;
      $$;
      create trigger caixa_movimento_sem_alteracao
        before update or delete on caixa_movimento
        for each row execute function caixa_movimento_imutavel();
    `,
  },
  {
    // Termo de responsabilidade (versionado, aceites imutáveis), data de
    // nascimento do cliente e contas a pagar.
    id: "0003_termo_e_financeiro",
    sql: `
      alter table cliente add column nascimento date;

      create table termo_versao (
        id text primary key,
        versao integer not null unique,
        texto text not null,
        criado_por text,
        criado_em timestamptz not null default clock_timestamp()
      );

      create table termo_aceite (
        id text primary key,
        cliente_id text not null references cliente (id),
        termo_versao_id text not null references termo_versao (id),
        assinante_nome text not null,
        por_menor boolean not null default false,
        registrado_por text,
        ip text,
        aceito_em timestamptz not null default clock_timestamp()
      );
      create index termo_aceite_cliente on termo_aceite (cliente_id, aceito_em desc);

      create function registro_imutavel() returns trigger
      language plpgsql as $$
      begin
        raise exception 'registro somente de inclusão (não pode ser alterado nem apagado)';
      end;
      $$;
      create trigger termo_versao_sem_alteracao
        before update or delete on termo_versao
        for each row execute function registro_imutavel();
      create trigger termo_aceite_sem_alteracao
        before update or delete on termo_aceite
        for each row execute function registro_imutavel();

      create table conta_pagar (
        id text primary key,
        descricao text not null,
        categoria text not null,
        fornecedor text,
        valor_centavos integer not null check (valor_centavos > 0),
        vencimento date not null,
        observacao text,
        pago_em timestamptz,
        pago_forma text
          check (pago_forma in ('dinheiro', 'pix', 'cartao', 'boleto', 'transferencia')),
        pago_por text,
        cancelada_em timestamptz,
        cancelada_por text,
        motivo_cancelamento text,
        criada_por text,
        criado_em timestamptz not null default clock_timestamp(),
        check ((pago_em is null) = (pago_forma is null)),
        check (pago_em is null or cancelada_em is null)
      );
      create index conta_pagar_vencimento on conta_pagar (vencimento);
    `,
  },
  {
    // Cronometragem: decoders (qualquer marca, via coletor + driver), cadastro
    // de transponders e o registro bruto das passagens (somente inclusão —
    // voltas e resultados são sempre calculados a partir dele).
    id: "0004_cronometragem",
    sql: `
      create table decoder (
        id text primary key,
        nome text not null,
        driver text not null,
        endereco text,
        token_hash text not null unique,
        ativo boolean not null default true,
        ultimo_sinal timestamptz,
        ultima_passagem timestamptz,
        criado_em timestamptz not null default clock_timestamp()
      );

      create table transponder (
        codigo text primary key,
        rotulo text,
        criado_em timestamptz not null default clock_timestamp()
      );

      create table passagem (
        id bigint generated always as identity primary key,
        decoder_id text not null references decoder (id),
        transponder text not null,
        instante timestamptz not null,
        relogio text not null default 'decoder'
          check (relogio in ('decoder', 'coletor')),
        forca integer,
        bruto text,
        recebido_em timestamptz not null default clock_timestamp(),
        unique (decoder_id, transponder, instante)
      );
      create index passagem_instante on passagem (instante desc);
      create index passagem_transponder on passagem (transponder, instante);

      create trigger passagem_sem_alteracao
        before update or delete on passagem
        for each row execute function registro_imutavel();
    `,
  },
  {
    // Corrida (bateria cronometrada): grid de pilotos, vínculo piloto ↔
    // sensor (transponder) e janela de tempo em que as passagens contam.
    id: "0005_corrida",
    sql: `
      create table corrida (
        id text primary key,
        nome text not null,
        slot_id text references bateria_slot (id),
        estado text not null default 'aguardando'
          check (estado in ('aguardando', 'em_andamento', 'encerrada')),
        tempo_minimo_ms integer not null default 10000
          check (tempo_minimo_ms between 1000 and 600000),
        duracao_min integer check (duracao_min > 0),
        iniciada_em timestamptz,
        encerrada_em timestamptz,
        criada_por text,
        criado_em timestamptz not null default clock_timestamp(),
        check ((estado = 'aguardando') = (iniciada_em is null)),
        check ((estado = 'encerrada') = (encerrada_em is not null))
      );
      -- Uma pista, um decoder: só UMA corrida em andamento por vez.
      create unique index corrida_uma_em_andamento
        on corrida ((true)) where estado = 'em_andamento';
      create unique index corrida_slot_unico
        on corrida (slot_id) where slot_id is not null;

      create table corrida_piloto (
        id text primary key,
        corrida_id text not null references corrida (id),
        nome text not null,
        cliente_id text references cliente (id),
        reserva_id text references reserva (id),
        transponder text references transponder (codigo),
        -- Preenchido quando o operador pede "capturar o próximo sensor".
        captura_armada_em timestamptz,
        criado_em timestamptz not null default clock_timestamp()
      );
      create index corrida_piloto_corrida on corrida_piloto (corrida_id);
      create unique index corrida_piloto_sensor
        on corrida_piloto (corrida_id, transponder) where transponder is not null;
    `,
  },
  {
    // Motor de cronometragem: cadastro completo de transponders, karts (dois
    // modelos de vínculo), máquina de estados da corrida, correções
    // administrativas que preservam o valor anterior, eventos rejeitados e
    // diagnóstico da conexão do decoder. Só acrescenta: nenhum dado existente
    // é apagado (os estados antigos são apenas renomeados).
    id: "0006_motor_cronometragem",
    sql: `
      -- Transponder: id interno + dados do equipamento. "codigo" continua
      -- sendo o identificador externo (texto: preserva zeros à esquerda).
      alter table transponder add column id text;
      update transponder set id = 'tp-' || gen_random_uuid()::text where id is null;
      alter table transponder alter column id set not null;
      alter table transponder alter column id set default 'tp-' || gen_random_uuid()::text;
      alter table transponder add constraint transponder_id_unico unique (id);
      alter table transponder add column modelo text;
      alter table transponder add column status text not null default 'ativo'
        check (status in ('ativo', 'inativo', 'manutencao'));
      alter table transponder add column observacoes text;
      -- false = o decoder leu, mas ninguém cadastrou ainda (sensor desconhecido).
      alter table transponder add column cadastrado boolean not null default false;
      alter table transponder add column atualizado_em timestamptz not null default clock_timestamp();

      create table kart (
        id text primary key,
        numero text not null,
        apelido text,
        status text not null default 'ativo'
          check (status in ('ativo', 'manutencao', 'inativo')),
        -- Modelo A: transponder fixo no kart.
        transponder_fixo text references transponder (codigo),
        observacoes text,
        criado_em timestamptz not null default clock_timestamp(),
        atualizado_em timestamptz not null default clock_timestamp()
      );
      create unique index kart_numero_unico on kart (lower(numero));
      create unique index kart_transponder_fixo_unico
        on kart (transponder_fixo) where transponder_fixo is not null;

      -- Configuração da instalação (linha única).
      create table config_cronometragem (
        id boolean primary key default true check (id),
        -- 'kart': o transponder pertence ao kart; 'piloto': é vinculado ao
        -- piloto na sessão (o kart usado é só registrado).
        modelo_vinculo text not null default 'piloto'
          check (modelo_vinculo in ('kart', 'piloto')),
        atualizado_em timestamptz not null default clock_timestamp(),
        atualizado_por text
      );
      insert into config_cronometragem default values;

      -- Decoder: estado da conexão informado pelo coletor.
      alter table decoder add column modelo text;
      alter table decoder add column conectado boolean not null default false;
      alter table decoder add column conectado_desde timestamptz;
      alter table decoder add column ultimo_erro text;
      alter table decoder add column ultimo_erro_em timestamptz;
      alter table decoder add column ultimo_ip text;

      create table decoder_evento (
        id bigint generated always as identity primary key,
        decoder_id text not null references decoder (id),
        tipo text not null
          check (tipo in ('coletor_iniciado', 'conectado', 'desconectado', 'erro')),
        detalhe text,
        ocorrido_em timestamptz not null,
        recebido_em timestamptz not null default clock_timestamp()
      );
      create index decoder_evento_decoder on decoder_evento (decoder_id, id desc);

      -- Itens do lote que o servidor não aceitou (estrutura inválida etc.).
      create table evento_rejeitado (
        id bigint generated always as identity primary key,
        decoder_id text not null references decoder (id),
        motivo text not null,
        transponder text,
        bruto text,
        recebido_em timestamptz not null default clock_timestamp()
      );
      create index evento_rejeitado_decoder on evento_rejeitado (decoder_id, id desc);

      -- Identificador do evento quando o equipamento fornece um.
      alter table passagem add column evento_externo text;
      create unique index passagem_evento_externo
        on passagem (decoder_id, evento_externo) where evento_externo is not null;

      -- Corrida: seis estados, regras configuráveis e resultado publicado.
      do $$
      declare r record;
      begin
        for r in
          select conname from pg_constraint
           where conrelid = 'corrida'::regclass and contype = 'c'
             and pg_get_constraintdef(oid) like '%estado%'
        loop
          execute format('alter table corrida drop constraint %I', r.conname);
        end loop;
      end $$;
      update corrida set estado = 'preparada' where estado = 'aguardando';
      update corrida set estado = 'finalizada' where estado = 'encerrada';
      alter table corrida alter column estado set default 'preparada';
      alter table corrida add column encerrando_em timestamptz;
      alter table corrida add column cancelada_em timestamptz;
      alter table corrida add column cancelada_por text;
      alter table corrida add column motivo_cancelamento text;
      -- 'primeira_passagem': a 1ª leitura é a largada (a volta 1 termina na 2ª);
      -- 'largada_da_corrida': a volta 1 é medida desde o início da corrida.
      alter table corrida add column regra_largada text not null default 'primeira_passagem'
        check (regra_largada in ('primeira_passagem', 'largada_da_corrida'));
      -- 'manual': o operador finaliza; 'proxima_passagem': ao fim do tempo,
      -- cada piloto termina na primeira passagem seguinte; 'corte_imediato':
      -- passagens depois do fim do tempo não contam.
      alter table corrida add column modo_encerramento text not null default 'manual'
        check (modo_encerramento in ('manual', 'proxima_passagem', 'corte_imediato'));
      alter table corrida add column espera_final_s integer not null default 120
        check (espera_final_s between 0 and 3600);
      alter table corrida add column resultado_final jsonb;
      alter table corrida add constraint corrida_estado_valido
        check (estado in ('preparada', 'pronta', 'em_andamento', 'encerrando', 'finalizada', 'cancelada'));
      alter table corrida add constraint corrida_inicio_coerente
        check (
          (estado in ('preparada', 'pronta') and iniciada_em is null)
          or (estado in ('em_andamento', 'encerrando', 'finalizada') and iniciada_em is not null)
          or estado = 'cancelada'
        );
      alter table corrida add constraint corrida_encerrando_coerente
        check (estado <> 'encerrando' or encerrando_em is not null);
      alter table corrida add constraint corrida_finalizada_coerente
        check ((estado = 'finalizada') = (encerrada_em is not null));
      alter table corrida add constraint corrida_cancelada_coerente
        check ((estado = 'cancelada') = (cancelada_em is not null));
      drop index corrida_uma_em_andamento;
      create unique index corrida_uma_ativa
        on corrida ((true)) where estado in ('em_andamento', 'encerrando');

      -- Participação: guarda o kart e o modelo de vínculo usados NAQUELA
      -- corrida (mudar o cadastro depois não altera o histórico).
      alter table corrida_piloto add column kart_id text references kart (id);
      alter table corrida_piloto add column kart_numero text;
      alter table corrida_piloto add column modelo_vinculo text
        check (modelo_vinculo in ('kart', 'piloto'));
      create unique index corrida_piloto_kart
        on corrida_piloto (corrida_id, kart_id) where kart_id is not null;

      -- Correções administrativas: nunca alteram a passagem original; cada uma
      -- fica registrada (quem, quando, por quê) e só pode ser ANULADA.
      create table correcao_passagem (
        id text primary key,
        corrida_id text not null references corrida (id),
        tipo text not null check (tipo in ('invalidar', 'inserir')),
        passagem_id bigint references passagem (id),
        transponder text references transponder (codigo),
        instante timestamptz,
        motivo text not null check (length(trim(motivo)) >= 3),
        criado_por text,
        criado_em timestamptz not null default clock_timestamp(),
        anulada_em timestamptz,
        anulada_por text,
        motivo_anulacao text,
        check ((tipo = 'invalidar') = (passagem_id is not null)),
        check ((tipo = 'inserir') = (transponder is not null and instante is not null)),
        check ((anulada_em is null) = (motivo_anulacao is null))
      );
      create index correcao_passagem_corrida on correcao_passagem (corrida_id);

      create function correcao_somente_anulacao() returns trigger
      language plpgsql as $$
      begin
        if tg_op = 'DELETE' then
          raise exception 'correção não pode ser apagada: anule-a informando o motivo';
        end if;
        if old.anulada_em is not null
           or (new.id, new.corrida_id, new.tipo, new.passagem_id, new.transponder,
               new.instante, new.motivo, new.criado_por, new.criado_em)
              is distinct from
              (old.id, old.corrida_id, old.tipo, old.passagem_id, old.transponder,
               old.instante, old.motivo, old.criado_por, old.criado_em) then
          raise exception 'correção só pode ser anulada (uma vez)';
        end if;
        return new;
      end;
      $$;
      create trigger correcao_passagem_protegida
        before update or delete on correcao_passagem
        for each row execute function correcao_somente_anulacao();
    `,
  },
  {
    // Bateria no estilo LapTime: cada kart tem um sensor fixo cadastrado; na
    // bateria, o kart entra na classificação sozinho ao passar e o piloto
    // recebe o nome depois da 1ª passagem. Participantes criados assim nascem
    // sem nome ("nomeado = false").
    id: "0007_bateria_por_kart",
    sql: `
      alter table corrida_piloto add column nomeado boolean not null default true;
      alter table config_cronometragem alter column modelo_vinculo set default 'kart';
      update config_cronometragem
         set modelo_vinculo = 'kart', atualizado_em = clock_timestamp(),
             atualizado_por = 'sistema (0007)'
       where modelo_vinculo <> 'kart';
    `,
  },
  {
    // Sensores do kart: um kart pode trocar de sensor (defeito) ou ter mais de
    // um; o histórico de quais sensores o kart teve fica guardado. E, numa
    // bateria, o piloto pode ter mais de um sensor lido (o do kart trocado no
    // meio da bateria): as passagens de todos contam para o mesmo piloto.
    id: "0008_sensores_do_kart",
    sql: `
      create table kart_sensor (
        id bigint generated always as identity primary key,
        kart_id text not null references kart (id),
        transponder text not null references transponder (codigo),
        adicionado_em timestamptz not null default clock_timestamp(),
        adicionado_por text,
        removido_em timestamptz,
        removido_por text,
        motivo_remocao text
      );
      -- Um sensor só pode estar ATIVO em um kart; o histórico não tem limite.
      create unique index kart_sensor_ativo
        on kart_sensor (transponder) where removido_em is null;
      create index kart_sensor_kart on kart_sensor (kart_id, id desc);
      insert into kart_sensor (kart_id, transponder, adicionado_por)
        select id, transponder_fixo, 'sistema (0008)'
          from kart where transponder_fixo is not null;

      alter table corrida_piloto
        add column sensores_extras text[] not null default '{}';
    `,
  },
  {
    // Cadastro numerado do cliente, responsável da bateria e termo assinado
    // digitalmente (por link): a assinatura desenhada e as evidências ficam no
    // aceite, que continua imutável. Nada é apagado.
    id: "0009_termo_digital_e_responsavel",
    sql: `
      alter table cliente add column numero integer generated always as identity;
      create unique index cliente_numero on cliente (numero);

      alter table corrida
        add column responsavel_cliente_id text references cliente (id);

      alter table termo_aceite
        add column canal text not null default 'balcao'
          check (canal in ('balcao', 'link')),
        add column assinatura_png text,
        add column texto_hash text,
        add column documento text,
        add column user_agent text;

      -- Link de assinatura de um cliente. O token é a chave de acesso (longo,
      -- aleatório, com validade); só serve para assinar o termo deste cliente.
      create table termo_convite (
        id text primary key,
        cliente_id text not null references cliente (id),
        token text not null unique,
        corrida_id text references corrida (id),
        criado_por text,
        criado_em timestamptz not null default clock_timestamp(),
        expira_em timestamptz not null,
        usado_em timestamptz,
        aceite_id text references termo_aceite (id)
      );
      create index termo_convite_cliente on termo_convite (cliente_id, criado_em desc);
    `,
  },
  {
    // Computador da pista: o agente (coletor/agente.mjs) é pareado uma vez com
    // um código de uso único e passa a mandar o inventário do que está ligado
    // nele (USB, portas seriais, aparelhos na rede). O sistema destaca o que
    // aparece de novo e guarda o perfil do dispositivo que o operador confirmar
    // como decoder. Só leitura: nada disso envia dados aos aparelhos.
    id: "0010_computador_da_pista",
    sql: `
      create table coletor_pareamento (
        id text primary key,
        codigo_hash text not null unique,
        criado_por text,
        criado_em timestamptz not null default clock_timestamp(),
        expira_em timestamptz not null,
        usado_em timestamptz
      );

      create table coletor_computador (
        id text primary key,
        nome text not null,
        token_hash text not null unique,
        sistema text,
        pareado_em timestamptz not null default clock_timestamp(),
        pareado_por text,
        ultimo_contato timestamptz,
        ultimo_ip text,
        inventario jsonb not null default '[]'::jsonb,
        -- Chaves dos dispositivos que já estavam ligados (não são o decoder).
        base jsonb,
        revogado_em timestamptz
      );

      -- Dispositivos que o operador confirmou como decoder: nas próximas vezes
      -- o sistema os reconhece sozinho assim que forem ligados.
      create table dispositivo_decoder (
        chave text primary key,
        nome text not null,
        confirmado_por text,
        confirmado_em timestamptz not null default clock_timestamp()
      );
    `,
  },
  {
    // Pilotos de cada reserva (cada um com cadastro), pagamento por piloto e
    // bateria em duas fases (classificação e corrida). Aditiva: nada é
    // apagado; só o índice que limitava UMA corrida por horário da agenda é
    // trocado por um que limita uma por horário e fase.
    id: "0011_pilotos_da_reserva_e_fases",
    sql: `
      create table reserva_piloto (
        id text primary key,
        reserva_id text not null references reserva (id),
        cliente_id text not null references cliente (id),
        ordem integer not null,
        criado_por text,
        criado_em timestamptz not null default clock_timestamp(),
        unique (reserva_id, cliente_id)
      );
      create index reserva_piloto_reserva on reserva_piloto (reserva_id, ordem);
      -- Quem fez a reserva é o 1º piloto (ajustável depois).
      insert into reserva_piloto (id, reserva_id, cliente_id, ordem, criado_por)
        select 'rpil-' || r.id, r.id, r.cliente_id, 1, 'sistema (0011)'
          from reserva r where r.status = 'reservada';

      -- Pagamento atribuído a um piloto da reserva (sem atribuição = da reserva).
      alter table caixa_movimento
        add column reserva_piloto_id text references reserva_piloto (id);
      create index caixa_movimento_piloto on caixa_movimento (reserva_piloto_id)
        where reserva_piloto_id is not null;

      alter table corrida
        add column fase text not null default 'unica'
          check (fase in ('unica', 'classificacao', 'corrida')),
        add column classificacao_id text references corrida (id);
      drop index corrida_slot_unico;
      create unique index corrida_slot_fase_unico
        on corrida (slot_id, fase) where slot_id is not null;

      -- Posição de largada da corrida (vem da classificação).
      alter table corrida_piloto add column posicao_grid integer;
    `,
  },
  {
    // Tempo planejado da corrida, definido na classificação (editável até a
    // corrida ser criada; depois, na própria corrida).
    id: "0012_tempo_da_corrida",
    sql: `
      alter table corrida
        add column duracao_corrida_min integer
          check (duracao_corrida_min between 1 and 240);
    `,
  },
  {
    // Check-in (presença) e ocorrências por participante: DNS/DNF/DSQ e
    // penalidade em tempo. Tudo auditado; nada é apagado.
    id: "0013_checkin_e_ocorrencias",
    sql: `
      alter table corrida_piloto
        add column presente_em timestamptz,
        add column situacao_manual text
          check (situacao_manual in ('dns', 'dnf', 'dsq')),
        add column penalidade_ms integer not null default 0
          check (penalidade_ms between 0 and 3600000),
        add column ocorrencia_motivo text;
    `,
  },
  {
    // Imagem de apresentação por campeonato (chave = id do campeonato).
    id: "0014_campeonato_imagem",
    sql: `
      create table campeonato_imagem (
        campeonato_id text primary key,
        tipo_mime text not null
          check (tipo_mime in ('image/jpeg', 'image/png', 'image/webp')),
        dados bytea not null check (octet_length(dados) <= 2097152),
        texto_alternativo text not null check (char_length(texto_alternativo) <= 200),
        atualizado_por text,
        atualizado_em timestamptz not null default clock_timestamp()
      );
    `,
  },
  {
    // Decoder cadastrado sozinho pelo computador da pista (plug-and-play) e
    // informações extras que o driver relata (ex.: ruído da antena do CalX Pro).
    id: "0015_decoder_automatico",
    sql: `
      alter table decoder
        add column computador_id text references coletor_computador (id),
        add column info jsonb;
      create unique index decoder_computador_driver
        on decoder (computador_id, driver) where computador_id is not null;
    `,
  },
  {
    // Apelido do cliente: o nome pelo qual o piloto é conhecido na pista. Entra na busca do
    // piloto da bateria (nome, apelido, número ou telefone). Opcional; cadastros antigos ficam
    // sem apelido. (0016 e 0017 são propostas ainda não aprovadas; por isso 0018.)
    id: "0018_apelido_do_cliente",
    sql: `
      alter table cliente
        add column apelido text check (apelido is null or char_length(apelido) <= 40);
    `,
  },
  {
    // Vídeo de apresentação do piloto: recorte da foto de macacão e cor da faixa. Estrutural: só roda
    // sozinha em banco de desenvolvimento; em produção o SQL é aplicado à mão. O código funciona
    // sem a tabela (a apresentação simplesmente não aparece).
    id: "0019_piloto_apresentacao",
    estrutural: true,
    sql: `
      create table piloto_apresentacao (
        piloto_id text primary key references piloto (id) on delete cascade,
        foto_corpo text not null check (char_length(foto_corpo) <= 900000),
        cor_faixa text not null check (cor_faixa ~ '^#[0-9a-fA-F]{6}$'),
        atualizado_em timestamptz not null default clock_timestamp()
      );
    `,
  },
  {
    // Perfil editável do piloto: data de nascimento (a idade deriva dela) e número único. Estrutural:
    // em produção o SQL é aplicado à mão (deploy/discloud/piloto-nascimento-numero.sql, o mesmo texto).
    id: "0020_piloto_nascimento_e_numero_unico",
    estrutural: true,
    sql: `
      -- Data de nascimento do piloto (a idade passa a ser calculada a partir dela).
      alter table piloto add column if not exists nascimento date;

      -- Número do piloto não pode repetir. Se já houver repetidos, o mais antigo
      -- fica com o número e os demais recebem números novos acima do maior.
      with repetidos as (
        select id,
               row_number() over (partition by numero order by criado_em, id) as ordem
          from piloto
      ), a_trocar as (
        select id, row_number() over (order by id) as pos
          from repetidos where ordem > 1
      )
      update piloto p
         set numero = (select coalesce(max(numero), 0) from piloto) + a.pos
        from a_trocar a
       where p.id = a.id;

      create unique index if not exists piloto_numero_unico on piloto (numero);
      drop index if exists piloto_numero;
    `,
  },
  {
    // Ajustes das categorias feitos no painel (nome, descrição e peso mínimo), por cima dos valores
    // padrão do código. Estrutural: em produção o SQL é aplicado à mão
    // (deploy/discloud/categoria-ajuste.sql, o mesmo texto). O código funciona sem a tabela.
    id: "0021_categoria_ajuste",
    estrutural: true,
    sql: `
      create table if not exists categoria_ajuste (
        id text primary key,
        nome text not null check (char_length(nome) between 2 and 40),
        descricao text not null check (char_length(descricao) <= 300),
        peso_minimo_kg integer not null check (peso_minimo_kg between 0 and 300),
        atualizado_por text,
        atualizado_em timestamptz not null default clock_timestamp()
      );
    `,
  },
  {
    // Campeonato completo: campeonatos, categorias do campeonato, biblioteca de traçados, traçados de
    // cada campeonato e logos dos patrocinadores. Estrutural: em produção o SQL é aplicado à mão
    // (deploy/discloud/campeonato-fluxo.sql, o mesmo texto).
    id: "0022_campeonato_fluxo",
    estrutural: true,
    sql: `
      create table if not exists campeonato (
        id text primary key,
        nome text not null check (char_length(nome) between 2 and 80),
        temporada text not null check (char_length(temporada) between 1 and 20),
        slug text not null unique,
        descricao text not null default '' check (char_length(descricao) <= 400),
        ativo boolean not null default false,
        encerrado_em timestamptz,
        criado_por text,
        criado_em timestamptz not null default clock_timestamp()
      );

      -- So um campeonato pode estar ativo por vez.
      create unique index if not exists campeonato_um_ativo on campeonato (ativo) where ativo;

      -- Biblioteca de tracados desenhados no editor 3D (reaproveitaveis entre campeonatos).
      create table if not exists tracado (
        id text primary key,
        nome text not null check (char_length(nome) between 2 and 80),
        descricao text check (descricao is null or char_length(descricao) <= 300),
        pontos jsonb not null,
        fechado boolean not null default false,
        extensao_metros integer check (extensao_metros is null or extensao_metros >= 0),
        criado_em timestamptz not null default clock_timestamp()
      );

      create table if not exists campeonato_tracado (
        campeonato_id text not null references campeonato (id) on delete cascade,
        tracado_id text not null references tracado (id) on delete restrict,
        ordem integer not null default 0,
        primary key (campeonato_id, tracado_id)
      );

      -- Categorias que existem em cada campeonato (as categorias em si ficam no codigo: Master, Rookie...).
      create table if not exists campeonato_categoria (
        campeonato_id text not null references campeonato (id) on delete cascade,
        categoria_id text not null check (char_length(categoria_id) between 1 and 40),
        primary key (campeonato_id, categoria_id)
      );

      -- Logos dos patrocinadores de cada campeonato (imagem reduzida, guardada como data URL).
      create table if not exists campeonato_logo (
        id text primary key,
        campeonato_id text not null references campeonato (id) on delete cascade,
        nome text not null check (char_length(nome) between 1 and 60),
        logo text not null check (char_length(logo) <= 700000),
        ordem integer not null default 0,
        criado_em timestamptz not null default clock_timestamp()
      );
      create index if not exists campeonato_logo_campeonato on campeonato_logo (campeonato_id, ordem);
    `,
  },
];
