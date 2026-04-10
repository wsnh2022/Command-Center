type A = { x: string }; let a: A | null = null; if(a) { let k: keyof typeof a = 'x'; }
