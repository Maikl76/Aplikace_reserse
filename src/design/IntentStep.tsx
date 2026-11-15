import { mergeDesign, patchProject } from '../lib/db';
import { BUILDERS, CONTEXTS, EXPERIENCE, HORIZONS } from '../lib/design/catalog';
import { designOf } from '../lib/design/logic';
import type { DesignIntent } from '../lib/types';
import type { StepProps } from '../pages/ProjectPage';
import { Field, Notice, Seg, TextArea, TextInput } from '../ui';
import { Group } from './shared';

export default function IntentStep({ project }: StepProps) {
  const i = designOf(project).intent;
  const set = (partial: Partial<DesignIntent>) => mergeDesign(project.id, 'intent', partial);

  return (
    <div className="stack">
      <section className="card">
        <Field label="Pracovní název aplikace" hint="Použije se jako název návrhu; můžete ho kdykoli změnit.">
          <TextInput value={project.title} onCommit={(title) => patchProject(project.id, { title: title.trim() || project.title })} />
        </Field>
      </section>

      <section className="card">
        <h3>Problém a uživatelé</h3>
        <div className="stack">
          <Field label="Jaký problém aplikace řeší" hint="Popište potíž, kterou někdo má, ne řešení. Dvě až tři věty.">
            <TextArea value={i.problem} rows={3} onCommit={(problem) => set({ problem })} placeholder="Např. Pacienti po operaci dostanou plán cvičení na papíře a po několika týdnech nevědí, co už mají cvičit." />
          </Field>
          <Field label="Pro koho je určena" hint="Tak konkrétně, abyste věděli, koho se zeptat na názor.">
            <TextArea value={i.users} rows={2} onCommit={(users) => set({ users })} />
          </Field>
          <Field label="Co s ní má uživatel dokázat" hint="Hlavní úkol, kvůli kterému aplikaci otevře.">
            <TextArea value={i.goal} rows={2} onCommit={(goal) => set({ goal })} />
          </Field>
          <Field label="Podle čeho poznáte, že plní účel" hint="Něco, co půjde po čase ověřit.">
            <TextArea value={i.success} rows={2} onCommit={(success) => set({ success })} />
          </Field>
        </div>
      </section>

      <section className="card">
        <h3>Okolnosti</h3>
        <div className="stack">
          <Group label="V jakém rámci aplikace vzniká">
            <Seg value={i.context} options={CONTEXTS} onChange={(context) => set({ context })} ariaLabel="Rámec" />
          </Group>
          <Group label="Kdo ji bude stavět">
            <Seg value={i.builder} options={BUILDERS} onChange={(builder) => set({ builder })} ariaLabel="Kdo staví" />
          </Group>
          <Group label="Zkušenost s programováním" hint="Zkušenost toho, kdo bude aplikaci stavět a hlavně udržovat.">
            <Seg value={i.experience} options={EXPERIENCE} onChange={(experience) => set({ experience })} ariaLabel="Zkušenost" />
          </Group>
          <Group label="Jak dlouho má aplikace běžet" hint="Od odpovědi se odvíjí, co všechno je potřeba zajistit po obhajobě.">
            <Seg value={i.horizon} options={HORIZONS} onChange={(horizon) => set({ horizon })} ariaLabel="Doba provozu" />
          </Group>
          <Field label="Kdo se o ni postará, až projekt skončí" hint="Jméno nebo pracoviště. Pokud to nevíte, je to první otázka pro vedoucího.">
            <TextArea value={i.maintainer} rows={2} onCommit={(maintainer) => set({ maintainer })} />
          </Field>
          {i.horizon && i.horizon !== 'defence' && !i.maintainer.trim() ? <Notice kind="warn">Aplikace má běžet i po obhajobě, ale zatím není určeno, kdo se o ni postará. Bez toho po vašem odchodu zanikne nebo poběží bez dozoru.</Notice> : null}
          {i.horizon === 'defence' ? <Notice>Aplikace má sloužit jen do obhajoby. V práci přesto uveďte její stálou kopii, aby ji bylo možné později dohledat.</Notice> : null}
        </div>
      </section>
    </div>
  );
}
