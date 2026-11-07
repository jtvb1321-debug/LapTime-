using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;

// Atalho de duplo clique: liga (ou desliga, quando compilado com PARAR) o
// Grid Lap deste computador chamando o Node que vem no pacote, sem janela.
static class Programa
{
    [STAThread]
    static int Main()
    {
        string raiz = AppDomain.CurrentDomain.BaseDirectory;
        string node = Path.Combine(raiz, "node", "node.exe");
#if PARAR
        string script = Path.Combine(raiz, "launcher", "parar.mjs");
#else
        string script = Path.Combine(raiz, "launcher", "iniciar.mjs");
#endif
        if (!File.Exists(node) || !File.Exists(script))
        {
            MessageBox.Show("Arquivos do Grid Lap não encontrados. Extraia a pasta inteira antes de abrir.", "Grid Lap");
            return 1;
        }
        var info = new ProcessStartInfo(node, "\"" + script + "\"")
        {
            WorkingDirectory = raiz,
            CreateNoWindow = true,
            UseShellExecute = false
        };
#if PARAR
        var p = Process.Start(info);
        p.WaitForExit();
        MessageBox.Show("Grid Lap desligado.", "Grid Lap");
#else
        Process.Start(info);
        MessageBox.Show("Ligando o Grid Lap. O navegador abre sozinho em instantes (na primeira vez pode levar até 1 minuto). Clique em OK.", "Grid Lap");
#endif
        return 0;
    }
}
