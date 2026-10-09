// Testes automatizados básicos da IA
// Abra testes.html no navegador para executar.

(function () {
  const resultados = [];

  function testar(nome, funcao) {
    try {
      funcao();
      resultados.push({ nome, passou: true });
    } catch (erro) {
      resultados.push({ nome, passou: false, erro: erro.message });
    }
  }

  function afirmar(condicao, mensagem) {
    if (!condicao) throw new Error(mensagem || "A condição não foi atendida.");
  }

  const defensor = { nome: "Bulbasaur", hp: 50, tipo: ["grama", "veneno"] };
  const ataques = [
    { nome: "Investida", tipo: "normal", poder: 40, precisao: 100, efetividade: 1, pp: 35 },
    { nome: "Chama", tipo: "fogo", poder: 50, precisao: 100, efetividade: 2, pp: 25 },
    { nome: "Rajada", tipo: "fogo", poder: 100, precisao: 50, efetividade: 2, pp: 5 }
  ];

  testar("Escolhe o ataque de melhor pontuação", () => {
    const escolhido = IA.escolherAtaque({ ataques, defensor, dificuldade: "normal" });
    afirmar(escolhido.nome === "Chama", "Esperava Chama, mas escolheu " + escolhido.nome);
  });

  testar("Ignora ataque sem PP", () => {
    const escolhido = IA.escolherAtaque({
      ataques: [
        { nome: "Sem PP", poder: 200, precisao: 100, efetividade: 2, pp: 0 },
        { nome: "Disponível", poder: 30, precisao: 100, efetividade: 1, pp: 5 }
      ],
      defensor
    });
    afirmar(escolhido.nome === "Disponível");
  });

  testar("Ignora ataque marcado como indisponível", () => {
    const escolhido = IA.escolherAtaque({
      ataques: [
        { nome: "Bloqueado", poder: 200, disponivel: false },
        { nome: "Livre", poder: 20, precisao: 100 }
      ],
      defensor
    });
    afirmar(escolhido.nome === "Livre");
  });

  testar("Retorna null quando não há ataques disponíveis", () => {
    const escolhido = IA.escolherAtaque({
      ataques: [{ nome: "Esgotado", poder: 80, pp: 0 }],
      defensor
    });
    afirmar(escolhido === null);
  });

  testar("Retorna null quando a lista está vazia", () => {
    afirmar(IA.escolherAtaque({ ataques: [], defensor }) === null);
  });

  testar("Considera a precisão na pontuação", () => {
    const preciso = { nome: "Preciso", poder: 60, precisao: 100, efetividade: 1 };
    const arriscado = { nome: "Arriscado", poder: 100, precisao: 40, efetividade: 1 };
    afirmar(IA.pontuarAtaque(preciso, { hp: 100 }) > IA.pontuarAtaque(arriscado, { hp: 100 }));
  });

  testar("Dificuldade fácil escolhe um ataque disponível", () => {
    const escolhido = IA.escolherAtaque({
      ataques,
      defensor,
      dificuldade: "facil",
      aleatorio: () => 0
    });
    afirmar(ataques.includes(escolhido));
  });

  const area = document.getElementById("resultados");
  const resumo = document.getElementById("resumo");
  const aprovados = resultados.filter(r => r.passou).length;

  resumo.textContent = `${aprovados} de ${resultados.length} testes passaram.`;
  resultados.forEach(r => {
    const li = document.createElement("li");
    li.textContent = `${r.passou ? "PASSOU" : "FALHOU"} — ${r.nome}${r.erro ? ": " + r.erro : ""}`;
    li.className = r.passou ? "passou" : "falhou";
    area.appendChild(li);
  });
})();
