from data.repository import RepositoryCloner

if __name__ == '__main__':
    repository_cleaner = RepositoryCloner(n_results=1)
    repository_cleaner.clone_repositories()
    repository_cleaner.filter_repository_files()
