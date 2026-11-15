// Ukázkový návrh aplikace k vyzkoušení průvodce. Všechny údaje jsou smyšlené.

import { db, newDesignProject } from '../db';
import type { Project, Requirement } from '../types';
import { uid } from '../util';

const req = (text: string, priority: Requirement['priority'], source: Requirement['source'], sourceNote: string): Requirement => ({ id: uid(), text, priority, source, sourceNote });

export const DESIGN_DEMO_NOTE = 'Toto je ukázkový návrh aplikace. Pacienti, rozhovory i odpovědi školy jsou smyšlené; slouží jen k vyzkoušení průvodce.';

export function designDemoProject(): Project {
  const p = newDesignProject('Cvičební deník po operaci kolene (ukázka)');
  return {
    ...p,
    demo: DESIGN_DEMO_NOTE,
    design: {
      intent: {
        problem: 'Pacienti po operaci předního zkříženého vazu dostanou při propuštění plán domácího cvičení na papíře. Po několika týdnech nevědí, co už mají cvičit, a fyzioterapeut při kontrole neví, co skutečně cvičili.',
        users: 'Dospělí pacienti v prvních třech měsících po operaci, kteří cvičí doma, a jejich fyzioterapeut při kontrole.',
        goal: 'Pacient každý den vidí, co má cvičit, a jedním klepnutím zapíše, co odcvičil. Na kontrole ukáže přehled za uplynulé týdny.',
        success: 'Pacient po čtyřech týdnech používání dokáže na kontrole ukázat úplný záznam cvičení.',
        context: 'bachelor',
        builder: 'self-ai',
        experience: 'basic',
        horizon: 'years',
        maintainer: 'Vedoucí práce. Aplikace běží bez serveru, takže nevyžaduje průběžnou správu.',
      },
      requirements: [
        req('Pacient vidí cvičební plán pro aktuální týden po operaci.', 'must', 'assignment', 'zadání bakalářské práce'),
        req('Pacient zapíše, která cvičení v daný den provedl.', 'must', 'users', 'rozhovory se čtyřmi pacienty a dvěma fyzioterapeuty'),
        req('Pacient zobrazí přehled cvičení za uplynulé týdny a může ho ukázat na kontrole.', 'must', 'users', 'rozhovory se čtyřmi pacienty a dvěma fyzioterapeuty'),
        req('Pacient si může záznamy uložit do souboru a načíst je na jiném zařízení.', 'should', 'experience', 'data zůstávají jen v zařízení, bez exportu by o ně pacient mohl přijít'),
        req('Aplikace funguje bez připojení k internetu.', 'should', 'users', 'pacienti cvičí i tam, kde není signál'),
        req('Aplikace připomene cvičení v nastavený čas.', 'could', 'assumption', 'zatím neověřeno; vyžadovalo by server nebo aplikaci z obchodu'),
        req('Fyzioterapeut vidí záznamy pacienta na dálku.', 'could', 'assumption', 'vyžadovalo by server a zpracování zdravotních údajů; do první verze nezařazeno'),
      ],
      profile: { devices: 'both', store: 'no', hardware: 'none', offline: 'yes', accounts: 'no', data: 'local', collect: 'no', personal: 'special', notify: 'no', secrets: 'no', medical: 'unsure', scale: 'few', budget: 'zero' },
      solution: {
        type: 'static',
        why: 'Povinné požadavky se obejdou bez serveru. Záznamy o cvičení jsou údaje o zdraví; když zůstanou jen v telefonu pacienta, nikdo další je nezpracovává a po obhajobě není co udržovat. Připomínky a sdílení s fyzioterapeutem by server vyžadovaly, proto zůstaly mezi nepovinnými požadavky.',
        tech: 'TypeScript a React, sestavení nástrojem Vite; data v úložišti prohlížeče (IndexedDB); aplikaci lze přidat na plochu telefonu.',
      },
      deploy: {
        choice: 'repo',
        extras: ['archive', 'download'],
        why: 'Provoz je zdarma a nevyžaduje správu. Adresa je vázaná na osobní účet, proto práce odkáže i na archivovanou verzi s trvalým identifikátorem a aplikace bude přiložena jako soubor.',
      },
      school: {
        'q-guarantor': 'Vedoucí práce souhlasí, že repozitář převezme. Domluveno ústně, je potřeba potvrdit e-mailem.',
        'q-thesis': 'Podle pokynů katedry se aplikace přikládá jako archiv ZIP a v textu práce se uvádí odkaz.',
        'q-ai': 'Použití nástrojů AI je nutné popsat v úvodu práce a uvést v prohlášení.',
      },
      rules: {
        licence: 'MIT (čeká na potvrzení školy)',
        dataNote: 'Datum operace a záznamy o provedených cvičeních. Ukládají se jen v zařízení pacienta a nikam se neodesílají; pacient je může kdykoli vyexportovat nebo smazat.',
        handover: 'Repozitář převezme vedoucí práce. Aplikace nemá server, který by bylo potřeba vypínat; archivovaná verze zůstane dostupná trvale.',
      },
      plan: {
        's-confirm': { done: false, note: 'Čeká se na odpověď pověřence a na posouzení zdravotnického účelu.' },
        's-prototype': { done: true, note: 'Papírový prototyp vyzkoušen se třemi pacienty.' },
      },
      author: '',
      institution: '',
    },
  };
}

export async function createDesignDemo(): Promise<Project> {
  const project = designDemoProject();
  await db.projects.add(project);
  return project;
}
