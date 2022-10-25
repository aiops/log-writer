import logging
import os
import git.exc
import requests
import shutil
from git import Repo
from configuration.repository import supported_languages, supported_sort_by
from helpers.language import extension_mappings
from pathlib import Path
from langdetect import detect

logger = logging.getLogger("logsight." + __name__)
logging.basicConfig(level=logging.INFO)
MIN_LINES_PER_FILE = 50
MAX_LINES_PER_FILE = 1000


class RepositoryCloner:
    def __init__(self, language="python", sort_by="stars", n_results=100):
        if language not in supported_languages:
            logger.info(f"{language} is still not supported language by the logsight.ai autologger")
        if sort_by not in supported_sort_by:
            logger.info(f"{language} is still not supported sorting method by the logsight.ai autologger")
        self.language = language
        self.sort_by = sort_by
        self.n_results = n_results
        self.request_link = f"https://api.github.com/search/repositories?q=" \
                            f"language:{self.language}" \
                            f"&sort={self.sort_by}" \
                            f"&order=desc" \
                            f"&per_page={n_results}"

    def clone_repositories(self, output_dir="../data/repositories/"):
        if not os.path.isdir(output_dir):
            os.makedirs(output_dir)
            logger.info(f'Created folder: {output_dir} successfully')
        repositories = requests.get(self.request_link).json()["items"]
        for repository in repositories:
            if detect(repository["description"]) == "en":
                logger.info(f'Cloning repository : {repository["html_url"]}')
                try:
                    Repo.clone_from(repository["html_url"], output_dir + f"{self.language}/" + repository["name"])
                except git.exc.GitCommandError as e:
                    logger.error(e)
        return repositories

    def filter_repository_files(self, repository_dir='../data/repositories/', output_dir='../data/filter/'):
        if not os.path.isdir(output_dir):
            os.makedirs(output_dir)
            logger.info(f'Created folder: {output_dir} successfully')
        logger.info(f"Filtering files that contain the {self.language} language extension")
        files = list(Path(f"{repository_dir}{self.language}").rglob(f"*.{extension_mappings[self.language]}"))
        logger.info(f"Copying the files into the output directory")
        for index, file in enumerate(files):
            with open(file, 'r') as f:
                f_s = f.readlines()
            if MIN_LINES_PER_FILE <= len(f_s) < MAX_LINES_PER_FILE:
                shutil.copy2(file, output_dir + str(index) + f".{extension_mappings[self.language]}")
        logger.info(f"Filtering finished successfully")
