import { AlertTriangle, CheckCircle2, MessageSquare } from "lucide-react";
import { TASK_PROBLEM_CATEGORY_LABEL, type TaskComment } from "@poultryhub/shared/types/task";
import { useAuth } from "@poultryhub/shared/context/AuthContext";

function CommentTypeTag({ comment }: { comment: TaskComment }) {
  if (comment.commentType === "problem") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-danger)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--color-danger)]">
        <AlertTriangle size={10} />
        {comment.problemCategory ? TASK_PROBLEM_CATEGORY_LABEL[comment.problemCategory] : "Problem"}
      </span>
    );
  }
  if (comment.commentType === "completion") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-success)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--color-success)]">
        <CheckCircle2 size={10} />
        Completion note
      </span>
    );
  }
  return null;
}

export default function TaskCommentThread({ comments }: { comments: TaskComment[] }) {
  const { user } = useAuth();

  if (comments.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
        <MessageSquare size={22} className="text-[var(--color-muted)]" strokeWidth={1.75} />
        <p className="text-sm text-[var(--color-muted)]">No comments yet.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {comments.map((comment) => {
        const isMine = comment.userId === user?.id;
        return (
          <div key={comment.id} className={`flex flex-col gap-1 ${isMine ? "items-end" : "items-start"}`}>
            <div className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
              <span className="font-medium text-[var(--color-foreground)]">{isMine ? "You" : (comment.userName ?? "Unknown")}</span>
              <span>{new Date(comment.createdAt).toLocaleString()}</span>
            </div>
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap ${
                isMine
                  ? "bg-[var(--color-primary)] text-white"
                  : "border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-foreground)]"
              }`}
            >
              {comment.comment}
            </div>
            <CommentTypeTag comment={comment} />
          </div>
        );
      })}
    </div>
  );
}
