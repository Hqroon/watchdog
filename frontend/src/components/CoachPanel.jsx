import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const SEV_BORDER = {
  low:    "border-l-green-500",
  medium: "border-l-yellow-500",
  high:   "border-l-destructive",
};

const SEV_LABEL = {
  low:    "Low Risk",
  medium: "Medium Risk",
  high:   "High Risk",
};

export default function CoachPanel({ analysis }) {
  if (!analysis) return null;

  const { incident, coach } = analysis;
  const severity = incident?.severity ?? "low";

  if (incident?.safe || !incident) {
    return (
      <Card className={cn("border-l-4 border-l-green-500 shadow-none")}>
        <CardContent className="py-3 px-4 flex items-center gap-3">
          <span className="text-green-600 text-sm font-medium">
            No hazards detected — workstation is safe.
          </span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("border-l-4 shadow-none", SEV_BORDER[severity] ?? SEV_BORDER.low)}>
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-medium">
            {SEV_LABEL[severity] ?? SEV_LABEL.low}
          </CardTitle>
          <Badge variant="outline" className="text-xs text-muted-foreground ml-auto">
            {incident.category}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-3">
        <p className="text-sm text-foreground">{incident.description}</p>

        {coach ? (
          <div className="bg-muted rounded-lg px-3 py-2 space-y-1">
            <div className="flex items-center gap-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Coach</p>
              <Badge variant="outline" className="text-xs ml-auto">Local · Ollama</Badge>
            </div>
            <p className="text-sm text-foreground leading-relaxed">{coach}</p>
          </div>
        ) : (
          <div className="bg-muted rounded-lg px-3 py-2 space-y-2 animate-pulse">
            <div className="h-3 bg-muted-foreground/20 rounded w-1/4" />
            <div className="h-4 bg-muted-foreground/20 rounded w-3/4" />
            <div className="h-4 bg-muted-foreground/20 rounded w-1/2" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
