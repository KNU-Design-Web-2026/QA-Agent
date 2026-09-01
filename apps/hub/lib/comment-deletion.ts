export function canDeleteComment(authorId: string, actorId: string) {
  return authorId === actorId;
}
