export type DemoPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface DemoScenarioTask {
  title: string;
  description: string;
  priority: DemoPriority;
  action: string;
  workSeconds: number;
}

export interface DemoScenario {
  key: string;
  name: string;
  intro: string;
  tasks: DemoScenarioTask[];
}

/** Escenarios del juego. Cada tarea real de Tino tiene una acción (`action`) que el juego sabe dibujar y animar. */
export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    key: 'oficina',
    name: 'La oficina en llamas',
    intro: 'El servidor se prendió fuego, el teléfono no para de sonar y la planta se está secando.',
    tasks: [
      {
        title: 'Apagar el incendio del servidor',
        description: 'El rack echa humo y llamas. Iniciá el timer y el matafuegos entra en acción.',
        priority: 'CRITICAL',
        action: 'servidor',
        workSeconds: 15,
      },
      {
        title: 'Atender al cliente furioso',
        description: 'El teléfono suena sin parar. Iniciá el timer para atenderlo.',
        priority: 'HIGH',
        action: 'telefono',
        workSeconds: 12,
      },
      {
        title: 'Regar la planta',
        description: 'La planta de la oficina está mustia. Con el timer, la regamos.',
        priority: 'LOW',
        action: 'planta',
        workSeconds: 8,
      },
    ],
  },
  {
    key: 'casa',
    name: 'La casa patas arriba',
    intro: 'Se prende fuego la sartén, la basura desborda, hay platos sucios y polvo por todos lados.',
    tasks: [
      {
        title: 'Apagar la sartén en llamas',
        description: 'La sartén se prendió fuego en la cocina. ¡Primero esto!',
        priority: 'CRITICAL',
        action: 'sarten',
        workSeconds: 12,
      },
      {
        title: 'Sacar la basura',
        description: 'La bolsa desborda y ya hay moscas.',
        priority: 'HIGH',
        action: 'basura',
        workSeconds: 10,
      },
      {
        title: 'Lavar los platos',
        description: 'La pileta está llena de platos sucios.',
        priority: 'MEDIUM',
        action: 'platos',
        workSeconds: 12,
      },
      {
        title: 'Barrer el living',
        description: 'Hay una montaña de polvo en el living.',
        priority: 'LOW',
        action: 'polvo',
        workSeconds: 10,
      },
    ],
  },
  {
    key: 'jardin',
    name: 'El jardín abandonado',
    intro: 'Una canilla rota inunda todo, la huerta se seca, el pasto está altísimo y la cerca se cayó.',
    tasks: [
      {
        title: 'Cerrar la canilla que inunda',
        description: 'La canilla del fondo pierde agua y se está inundando el jardín.',
        priority: 'CRITICAL',
        action: 'canilla',
        workSeconds: 10,
      },
      {
        title: 'Regar la huerta',
        description: 'Las plantas de la huerta se están secando.',
        priority: 'HIGH',
        action: 'huerta',
        workSeconds: 12,
      },
      {
        title: 'Cortar el pasto',
        description: 'El pasto está tan alto que no se ve el piso.',
        priority: 'MEDIUM',
        action: 'pasto',
        workSeconds: 12,
      },
      {
        title: 'Arreglar la cerca',
        description: 'Se cayó una parte de la cerca.',
        priority: 'LOW',
        action: 'cerca',
        workSeconds: 10,
      },
    ],
  },
];

export const DEMO_SCENARIO_KEYS = DEMO_SCENARIOS.map((scenario) => scenario.key);

/** Nombre del proyecto de Tino donde viven las tareas del escenario. */
export function scenarioProjectName(scenario: DemoScenario): string {
  return `Feria · ${scenario.name}`;
}

export function findScenario(key: string): DemoScenario | undefined {
  return DEMO_SCENARIOS.find((scenario) => scenario.key === key);
}
