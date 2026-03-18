function UsersLoadingSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {[...Array(6)].map((_, index) => (
        <div
          key={index}
          className="bg-cyan-500/10 p-4 rounded-lg animate-pulse"
        >
          <div className="flex items-center gap-3">
            <div className="avatar">
              <div className="size-12 rounded-full bg-slate-700"></div>
            </div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-slate-700 rounded w-3/4"></div>
              <div className="h-3 bg-slate-700 rounded w-1/2"></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
export default UsersLoadingSkeleton;
