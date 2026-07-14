import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  ArrowRight,
  Bot,
  GraduationCap,
  Loader2,
  MessageCircle,
  RotateCcw,
  Send,
  User as UserIcon,
} from "lucide-react";
import Markdown from "react-markdown";
import { chatWithAssistant, evaluateDefenseAnswer, prepareDefense } from "../../services/ai";
import { useToast } from "../ui/Toast";
import type { ChatMessage, DefenseEvaluation, LogEntry, UserProfile } from "../../types/models";

type Props = {
  profile: UserProfile;
  logs: LogEntry[];
};

type SimulationStep = {
  question: string;
  answerHint: string;
  answer?: string;
  evaluation?: DefenseEvaluation;
};

const SUGGESTIONS = [
  "Aide-moi à formuler mon bilan de la semaine",
  "Quelles compétences ai-je le plus développées ?",
  "Comment présenter mon projet principal en 2 minutes ?",
  "Quels points faibles dois-je anticiper pour la soutenance ?",
];

function ChatBubble({ message, streaming }: { message: ChatMessage; streaming?: boolean }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
          isUser ? "bg-stone-200 dark:bg-stone-700" : "bg-emerald-100 dark:bg-emerald-900/40"
        }`}
      >
        {isUser ? (
          <UserIcon className="w-4 h-4 text-stone-500 dark:text-stone-300" />
        ) : (
          <Bot className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
        )}
      </div>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
          isUser
            ? "bg-emerald-600 text-white"
            : "bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-200"
        }`}
      >
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-sm prose-stone dark:prose-invert max-w-none">
            <Markdown>{message.content || (streaming ? "..." : "")}</Markdown>
          </div>
        )}
      </div>
    </div>
  );
}

export function AssistantTab({ profile, logs }: Props) {
  const { toast } = useToast();
  const [mode, setMode] = useState<"chat" | "simulation">("chat");

  // --- Chat ---
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingReply, setStreamingReply] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingReply]);

  const sendMessage = async (text?: string) => {
    const message = (text ?? input).trim();
    if (!message || streaming) return;

    const history = [...messages];
    setMessages((prev) => [...prev, { role: "user", content: message }]);
    setInput("");
    setStreaming(true);
    setStreamingReply("");

    try {
      const reply = await chatWithAssistant(
        { userData: profile, logs, history, message },
        setStreamingReply,
      );
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (error) {
      setMessages(history.concat({ role: "user", content: message }));
      toast(error instanceof Error ? error.message : "Erreur de l'assistant.", "error");
    } finally {
      setStreaming(false);
      setStreamingReply("");
    }
  };

  // --- Simulation de soutenance ---
  const [simLoading, setSimLoading] = useState(false);
  const [steps, setSteps] = useState<SimulationStep[] | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [answer, setAnswer] = useState("");
  const [evaluating, setEvaluating] = useState(false);

  const startSimulation = async () => {
    if (logs.length === 0) {
      toast("Ajoute d'abord des entrées de journal: le jury se base dessus.", "info");
      return;
    }
    setSimLoading(true);
    try {
      const prep = await prepareDefense(profile, logs);
      setSteps(prep.questions.map((q) => ({ question: q.question, answerHint: q.answerHint })));
      setCurrentStep(0);
      setAnswer("");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Impossible de lancer la simulation.", "error");
    } finally {
      setSimLoading(false);
    }
  };

  const submitAnswer = async () => {
    if (!steps || !answer.trim()) return;
    setEvaluating(true);
    try {
      const evaluation = await evaluateDefenseAnswer({
        userData: profile,
        question: steps[currentStep].question,
        answer,
      });
      setSteps((prev) =>
        prev
          ? prev.map((s, i) => (i === currentStep ? { ...s, answer, evaluation } : s))
          : prev,
      );
    } catch (error) {
      toast(error instanceof Error ? error.message : "Erreur lors de l'évaluation.", "error");
    } finally {
      setEvaluating(false);
    }
  };

  const nextQuestion = () => {
    setAnswer("");
    setCurrentStep((prev) => prev + 1);
  };

  const answered = steps?.filter((s) => s.evaluation) || [];
  const isFinished = steps !== null && currentStep >= steps.length;
  const averageScore =
    answered.length > 0
      ? Math.round((answered.reduce((sum, s) => sum + (s.evaluation?.score || 0), 0) / answered.length) * 10) / 10
      : 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="max-w-3xl flex flex-col h-full"
    >
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-bold text-stone-900 dark:text-white">Assistant IA</h2>
          <p className="text-stone-500 dark:text-stone-400">
            Il connaît ton journal et ton profil. Pose-lui tes questions.
          </p>
        </div>
        <div className="flex bg-stone-100 dark:bg-stone-800 rounded-xl p-1">
          <button
            onClick={() => setMode("chat")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              mode === "chat"
                ? "bg-white dark:bg-stone-900 text-stone-900 dark:text-white shadow-sm"
                : "text-stone-500 dark:text-stone-400"
            }`}
          >
            <MessageCircle className="w-4 h-4" />
            Discussion
          </button>
          <button
            onClick={() => setMode("simulation")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              mode === "simulation"
                ? "bg-white dark:bg-stone-900 text-stone-900 dark:text-white shadow-sm"
                : "text-stone-500 dark:text-stone-400"
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            Simulation soutenance
          </button>
        </div>
      </div>

      {mode === "chat" && (
        <div className="flex flex-col gap-4">
          <div className="space-y-4 min-h-[200px]">
            {messages.length === 0 && !streaming && (
              <div className="bg-white dark:bg-stone-900 p-8 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm">
                <p className="text-stone-600 dark:text-stone-300 mb-4 font-medium">
                  Quelques idées pour commencer :
                </p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => sendMessage(suggestion)}
                      className="px-4 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-sm text-stone-600 dark:text-stone-300 hover:border-emerald-400 dark:hover:border-emerald-600 transition-all text-left"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message, i) => (
              <ChatBubble key={i} message={message} />
            ))}
            {streaming && <ChatBubble message={{ role: "assistant", content: streamingReply }} streaming />}
            <div ref={bottomRef} />
          </div>

          <div className="flex gap-3 sticky bottom-0 bg-stone-50 dark:bg-stone-950 py-2">
            <input
              className="flex-1 p-4 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
              placeholder="Écris ton message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              disabled={streaming}
            />
            <button
              onClick={() => sendMessage()}
              disabled={streaming || !input.trim()}
              className="bg-emerald-600 dark:bg-emerald-500 text-white px-5 rounded-2xl font-medium hover:bg-emerald-700 dark:hover:bg-emerald-600 transition-all disabled:opacity-50 flex items-center"
            >
              {streaming ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>
        </div>
      )}

      {mode === "simulation" && (
        <div>
          {steps === null && (
            <div className="bg-white dark:bg-stone-900 p-12 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm text-center">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <GraduationCap className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-bold text-stone-900 dark:text-white mb-2">
                Entraîne-toi comme devant le jury
              </h3>
              <p className="text-stone-500 dark:text-stone-400 mb-8 max-w-md mx-auto">
                L'IA te pose les questions probables une par une, tu réponds, et elle note ta réponse
                avec un retour constructif.
              </p>
              <button
                onClick={startSimulation}
                disabled={simLoading}
                className="bg-blue-600 text-white px-8 py-3 rounded-xl font-medium hover:bg-blue-700 transition-all disabled:opacity-50 inline-flex items-center gap-2"
              >
                {simLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
                {simLoading ? "Préparation des questions..." : "Lancer la simulation"}
              </button>
            </div>
          )}

          {steps !== null && !isFinished && (
            <div className="bg-white dark:bg-stone-900 p-8 md:p-12 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                  Question {currentStep + 1} / {steps.length}
                </span>
                <div className="flex gap-1.5">
                  {steps.map((_, i) => (
                    <div
                      key={i}
                      className={`w-2 h-2 rounded-full ${
                        i < currentStep ? "bg-blue-500" : i === currentStep ? "bg-blue-300" : "bg-stone-200 dark:bg-stone-700"
                      }`}
                    />
                  ))}
                </div>
              </div>

              <h3 className="text-xl font-bold text-stone-900 dark:text-white mb-6">
                {steps[currentStep].question}
              </h3>

              {!steps[currentStep].evaluation ? (
                <>
                  <textarea
                    className="w-full h-36 p-4 rounded-xl border border-stone-200 dark:border-stone-700 bg-transparent dark:text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none mb-4"
                    placeholder="Réponds comme si tu étais devant le jury..."
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={submitAnswer}
                      disabled={evaluating || !answer.trim()}
                      className="bg-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                      {evaluating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                      {evaluating ? "Le jury délibère..." : "Valider ma réponse"}
                    </button>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="bg-stone-50 dark:bg-stone-800/50 p-5 rounded-2xl">
                    <p className="text-xs font-bold text-stone-400 dark:text-stone-500 uppercase mb-2">Ta réponse</p>
                    <p className="text-sm text-stone-600 dark:text-stone-300 whitespace-pre-wrap">
                      {steps[currentStep].answer}
                    </p>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-5 rounded-2xl border border-blue-100 dark:border-blue-800">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase">Retour du jury</p>
                      <span className="text-lg font-bold text-blue-700 dark:text-blue-300">
                        {steps[currentStep].evaluation!.score}/10
                      </span>
                    </div>
                    <p className="text-sm text-stone-700 dark:text-stone-300 mb-4">
                      {steps[currentStep].evaluation!.feedback}
                    </p>
                    <p className="text-xs font-bold text-stone-400 dark:text-stone-500 uppercase mb-2">
                      Formulation suggérée
                    </p>
                    <p className="text-sm text-stone-600 dark:text-stone-400 italic">
                      {steps[currentStep].evaluation!.improvedAnswer}
                    </p>
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={nextQuestion}
                      className="bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 px-6 py-3 rounded-xl font-medium hover:bg-stone-800 dark:hover:bg-white transition-all flex items-center gap-2"
                    >
                      {currentStep + 1 < steps.length ? "Question suivante" : "Voir le bilan"}
                      <ArrowRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {isFinished && steps && (
            <div className="bg-white dark:bg-stone-900 p-8 md:p-12 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm">
              <div className="text-center mb-10">
                <p className="text-sm font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2">
                  Simulation terminée
                </p>
                <p className="text-5xl font-bold text-stone-900 dark:text-white mb-2">{averageScore}/10</p>
                <p className="text-stone-500 dark:text-stone-400">Score moyen sur {answered.length} réponses</p>
              </div>

              <div className="space-y-4 mb-8">
                {steps.map((step, i) => (
                  <div key={i} className="flex items-center gap-4 bg-stone-50 dark:bg-stone-800/50 p-4 rounded-2xl">
                    <span className="text-lg font-bold text-blue-600 dark:text-blue-400 w-14 text-center shrink-0">
                      {step.evaluation ? `${step.evaluation.score}/10` : "—"}
                    </span>
                    <p className="text-sm text-stone-700 dark:text-stone-300">{step.question}</p>
                  </div>
                ))}
              </div>

              <div className="flex justify-center">
                <button
                  onClick={() => {
                    setSteps(null);
                    setCurrentStep(0);
                    setAnswer("");
                  }}
                  className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-700 transition-all"
                >
                  <RotateCcw className="w-5 h-5" />
                  Recommencer
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
